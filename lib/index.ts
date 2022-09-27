import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as subProcess from './sub-process';
import * as tmp from 'tmp';
import * as pMap from 'p-map';
import { MissingSubProjectError } from './errors';
import * as chalk from 'chalk';
import { DepGraph } from '@snyk/dep-graph';
import { legacyCommon, legacyPlugin as api } from '@snyk/cli-interface';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import { getGradleAttributesPretty } from './gradle-attributes-pretty';
import debugModule = require('debug');
import { buildGraph, SnykGraph } from './graph';
import type {
  CoordinateMap,
  PomCoords,
  Sha1Map,
  SnykHttpClient,
} from './types';

type ScannedProject = legacyCommon.ScannedProject;
type CallGraph = legacyCommon.CallGraph;
type CallGraphResult = legacyCommon.CallGraphResult;

// To enable debugging output, use `snyk -d`
let logger: debugModule.Debugger | null = null;

function debugLog(s: string) {
  if (logger === null) {
    // Lazy init: Snyk CLI needs to process the CLI argument "-d" first.
    // TODO(BST-648): more robust handling of the debug settings
    if (process.env.DEBUG) {
      debugModule.enable(process.env.DEBUG);
    }
    logger = debugModule('snyk-gradle-plugin');
  }
  logger(s);
}

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : "'";

const cannotResolveVariantMarkers = [
  'Cannot choose between the following',
  'Could not select value from candidates',
  'Unable to find a matching variant of project',
];

// TODO(kyegupov): the types below will be extracted to a common plugin interface library

export interface GradleInspectOptions {
  // A regular expression (Java syntax, case-insensitive) to select Gradle configurations.
  // If only one configuration matches, its attributes will be used for dependency resolution;
  // otherwise, an artificial merged configuration will be created (see configuration-attributes
  // below).
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  // This replaces legacy `-- --configuration=foo` argument specification.
  'configuration-matching'?: string;

  // A comma-separated list of key:value pairs, e.g. "buildtype=release,usage=java-runtime".
  // If specified, will scan all configurations for attributes with names that contain "keys" (case-insensitive)
  // and have values that have a string representation that match the specified one, and will copy
  // these attributes into the merged configuration.
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  'configuration-attributes'?: string;

  // For some reason, `--no-daemon` is not required for Unix, but on Windows, without this flag, apparently,
  // Gradle process just never exits, from the Node's standpoint.
  // Leaving default usage `--no-daemon`, because of backwards compatibility
  daemon?: boolean;
  reachableVulns?: boolean;
  callGraphBuilderTimeout?: number;
  initScript?: string;
  gradleNormalizeDeps?: boolean;
}

type Options = api.InspectOptions & GradleInspectOptions;
type VersionBuildInfo = api.VersionBuildInfo;

// Overload type definitions, so that when you call inspect() with an `options` literal (e.g. in tests),
// you will get a result of a specific corresponding type.
export async function inspect(
  root: string,
  targetFile: string,
  options?: api.SingleSubprojectInspectOptions & GradleInspectOptions,
  snykHttpClient?: SnykHttpClient,
): Promise<api.SinglePackageResult>;
export async function inspect(
  root: string,
  targetFile: string,
  options: api.MultiSubprojectInspectOptions & GradleInspectOptions,
  snykHttpClient?: SnykHttpClient,
): Promise<api.MultiProjectResult>;

// General implementation. The result type depends on the runtime type of `options`.
export async function inspect(
  root: string,
  targetFile: string,
  options?: Options,
  snykHttpClient?: SnykHttpClient,
): Promise<api.InspectResult> {
  debugLog(
    'Gradle inspect called with: ' +
      JSON.stringify({
        root,
        targetFile,
        allSubProjects: (options as any)?.allSubProjects,
        subProject: (options as any)?.subProject,
      }),
  );

  if (!options) {
    options = { dev: false };
  }
  let subProject = (options as api.SingleSubprojectInspectOptions).subProject;
  if (subProject) {
    subProject = subProject.trim();
  }
  const plugin: api.PluginMetadata = {
    name: 'bundled:gradle',
    runtime: 'unknown',
    targetFile: targetFileFilteredForCompatibility(targetFile),
    meta: {},
  };

  let callGraph: CallGraphResult | undefined;
  const targetPath = path.join(root, targetFile);

  if (options.reachableVulns) {
    const command = getCommand(root, targetFile);

    let initScriptPath: string | undefined;

    if (options.initScript) {
      initScriptPath = formatArgWithWhiteSpace(
        path.resolve(options.initScript),
      );
    }

    let confAttrs: string | undefined;

    if (options['configuration-attributes']) {
      confAttrs = options['configuration-attributes'];
    }

    const timeout = options?.callGraphBuilderTimeout
      ? options?.callGraphBuilderTimeout * 1000
      : undefined;

    callGraph = await getCallGraph(
      targetPath,
      command,
      initScriptPath,
      confAttrs,
      timeout,
    );
  }

  if (api.isMultiSubProject(options)) {
    if (subProject) {
      throw new Error(
        'gradle-sub-project flag is incompatible with multiDepRoots',
      );
    }
    const scannedProjects = await getAllDepsAllProjects(
      root,
      targetFile,
      options,
      snykHttpClient,
    );
    plugin.meta = plugin.meta || {};
    return {
      plugin,
      scannedProjects,
      callGraph,
    };
  }
  const depGraphAndDepRootNames = await getAllDepsOneProject(
    root,
    targetFile,
    options,
    snykHttpClient,
    subProject,
  );
  if (depGraphAndDepRootNames.allSubProjectNames) {
    plugin.meta = plugin.meta || {};
    plugin.meta.allSubProjectNames = depGraphAndDepRootNames.allSubProjectNames;
  }

  return {
    plugin,
    package: null, //TODO @boost: delete me once cli-interface makes it optional
    callGraph,
    dependencyGraph: depGraphAndDepRootNames.depGraph,
    meta: {
      gradleProjectName: depGraphAndDepRootNames.gradleProjectName,
      versionBuildInfo: depGraphAndDepRootNames.versionBuildInfo,
    },
  };
}

// See the comment for DepRoot.targetFile
// Note: for Gradle, we are not returning the name unless it's a .kts file.
// This is a workaround for a project naming problem happening in Registry
// (legacy projects are named without "build.gradle" attached to them).
// See ticket BST-529 re permanent solution.
function targetFileFilteredForCompatibility(
  targetFile: string,
): string | undefined {
  return path.basename(targetFile) === 'build.gradle.kts'
    ? targetFile
    : undefined;
}

export interface JsonDepsScriptResult {
  defaultProject: string;
  projects: ProjectsDict;
  allSubProjectNames: string[];
  versionBuildInfo?: VersionBuildInfo;
  sha1Map?: Sha1Map;
}

interface ProjectsDict {
  [project: string]: GradleProjectInfo;
}

interface GradleProjectInfo {
  depGraph?: DepGraph;
  snykGraph?: SnykGraph; // snykGraph from gradle init task
  targetFile: string;
  projectVersion: string;
}

function extractJsonFromScriptOutput(stdoutText: string): JsonDepsScriptResult {
  const lines = stdoutText.split('\n');
  let jsonLine: string | null = null;
  lines.forEach((l) => {
    if (/^JSONDEPS /.test(l)) {
      if (jsonLine !== null) {
        debugLog('More than one line with "JSONDEPS " prefix was returned;');
        debugLog('First line: ' + jsonLine);
        debugLog('Current line:' + l.substr(9));
        // TODO (@tardis): the init.gradle should protect against this using 'snykDepsConfExecuted' flag
        // the longer term fix here is to make multiple snyk graph outputs impossible by interacting with
        // Gradle API in a more consistent way.
        // For now, assume the first JSONDEPS found was correct
        return;
      }
      jsonLine = l.substr(9);
    }
  });
  if (jsonLine === null) {
    throw new Error(
      'No line prefixed with "JSONDEPS " was returned; full output:\n' +
        stdoutText,
    );
  }
  debugLog(
    'The command produced JSONDEPS output of ' +
      jsonLine!.length +
      ' characters',
  );
  return JSON.parse(jsonLine!);
}

async function getAllDepsOneProject(
  root: string,
  targetFile: string,
  options: Options,
  snykHttpClient: SnykHttpClient,
  subProject?: string,
): Promise<{
  depGraph: DepGraph;
  allSubProjectNames: string[];
  gradleProjectName: string;
  versionBuildInfo: VersionBuildInfo;
}> {
  const allProjectDeps = await getAllDeps(
    root,
    targetFile,
    options,
    snykHttpClient,
  );
  const allSubProjectNames = allProjectDeps.allSubProjectNames;

  return getTargetProject(subProject, allProjectDeps, allSubProjectNames);
}

function getTargetProject(
  subProject: string,
  allProjectDeps,
  allSubProjectNames: string[],
): {
  depGraph: DepGraph;
  allSubProjectNames: string[];
  gradleProjectName: string;
  versionBuildInfo: VersionBuildInfo;
} {
  const { projects, defaultProject, versionBuildInfo } = allProjectDeps;
  const targetProject = subProject || defaultProject;
  let gradleProjectName = defaultProject;
  if (subProject) {
    if (!allProjectDeps.projects || !allProjectDeps.projects[subProject]) {
      throw new MissingSubProjectError(subProject, allSubProjectNames);
    }
    gradleProjectName = `${allProjectDeps.defaultProject}/${subProject}`;
  }

  const { depGraph } = projects[targetProject];

  return {
    depGraph,
    allSubProjectNames,
    gradleProjectName,
    versionBuildInfo,
  };
}

async function getAllDepsAllProjects(
  root: string,
  targetFile: string,
  options: Options,
  snykHttpClient: SnykHttpClient,
): Promise<ScannedProject[]> {
  const allProjectDeps = await getAllDeps(
    root,
    targetFile,
    options,
    snykHttpClient,
  );
  return Object.keys(allProjectDeps.projects).map((projectId) => {
    const { defaultProject } = allProjectDeps;
    const gradleProjectName =
      projectId === defaultProject
        ? defaultProject
        : `${defaultProject}/${projectId}`;
    return {
      targetFile: targetFileFilteredForCompatibility(
        allProjectDeps.projects[projectId].targetFile,
      ),
      meta: {
        gradleProjectName,
        projectName: gradleProjectName,
        versionBuildInfo: allProjectDeps.versionBuildInfo,
        targetFile: allProjectDeps.projects[projectId].targetFile,
      },
      depGraph: allProjectDeps.projects[projectId].depGraph,
    };
  });
}

const reEcho = /^SNYKECHO (.*)$/;

async function printIfEcho(line: string) {
  const maybeMatch = reEcho.exec(line);
  if (maybeMatch) {
    debugLog(maybeMatch[1]);
  }
}

async function injectedPlugin(scriptName: string): Promise<{
  injectedPluginFilePath: string;
  cleanupCallback?: () => void;
}> {
  let initGradleAsset: string | null = null;

  if (/index.js$/.test(__filename)) {
    // running from ./dist
    // path.join call has to be exactly in this format, needed by "pkg" to build a standalone Snyk CLI binary:
    // https://www.npmjs.com/package/pkg#detecting-assets-in-source-code
    initGradleAsset = path.join(__dirname, '../lib', scriptName);
  } else if (/index.ts$/.test(__filename)) {
    // running from ./lib
    initGradleAsset = path.join(__dirname, scriptName);
  } else {
    throw new Error(`Cannot locate Snyk ${scriptName} script`);
  }

  // We could be running from a bundled CLI generated by `pkg`.
  // The Node filesystem in that case is not real: https://github.com/zeit/pkg#snapshot-filesystem
  // Copying the injectable script into a temp file.
  try {
    const tmpInitGradle = tmp.fileSync({ postfix: `-${scriptName}` });
    fs.writeSync(tmpInitGradle.fd, fs.readFileSync(initGradleAsset));
    return {
      injectedPluginFilePath: tmpInitGradle.name,
      cleanupCallback: tmpInitGradle.removeCallback,
    };
  } catch (error) {
    error.message =
      error.message +
      '\n\n' +
      'Failed to create a temporary file to host Snyk init script for Gradle build analysis.';
    throw error;
  }
}

// when running a project is making use of gradle wrapper, the first time we run `gradlew -v`, the download
// process happens, cluttering the parsing of the gradle output.
// will extract the needed data using a regex
function cleanupVersionOutput(gradleVersionOutput: string): string {
  // Everything since the first "------" line.
  // [\s\S] used instead of . as it's the easiest way to match \n too
  const matchedData = gradleVersionOutput.match(/(-{60}[\s\S]+$)/g);
  if (matchedData) {
    return matchedData[0];
  }
  debugLog('cannot parse gradle version output:' + gradleVersionOutput);
  return '';
}

function getVersionBuildInfo(
  gradleVersionOutput: string,
): VersionBuildInfo | undefined {
  try {
    const cleanedVersionOutput: string =
      cleanupVersionOutput(gradleVersionOutput);

    if (cleanedVersionOutput !== '') {
      const gradleOutputArray = cleanedVersionOutput.split(/\r\n|\r|\n/);
      // from first 3 new lines, we get the gradle version
      const gradleVersion = gradleOutputArray[1].split(' ')[1].trim();
      const versionMetaInformation = gradleOutputArray.slice(4);
      // from line 4 until the end we get multiple meta information such as Java, Groovy, Kotlin, etc.
      const metaBuildVersion: { [index: string]: string } = {};
      // Select the lines in "Attribute: value format"
      versionMetaInformation
        .filter((value) => value && value.length > 0 && value.includes(': '))
        .map((value) => value.split(/(.*): (.*)/))
        .forEach(
          (splitValue) =>
            (metaBuildVersion[toCamelCase(splitValue[1].trim())] =
              splitValue[2].trim()),
        );
      return {
        gradleVersion,
        metaBuildVersion,
      };
    }
  } catch (error) {
    debugLog('version build info not present, skipping ahead: ' + error);
  }
}

async function getGradleVersion(
  root: string,
  command: string,
): Promise<string> {
  debugLog('`gradle -v` command run: ' + command);
  let gradleVersionOutput = '[COULD NOT RUN gradle -v]';
  try {
    gradleVersionOutput = await subProcess.execute(command, ['-v'], {
      cwd: root,
    });
  } catch (_) {
    // intentionally empty
  }
  return gradleVersionOutput;
}

async function getAllDepsWithPlugin(
  root: string,
  targetFile: string,
  options: Options,
): Promise<JsonDepsScriptResult> {
  const command = getCommand(root, targetFile);
  const { injectedPluginFilePath, cleanupCallback } = await injectedPlugin(
    'init.gradle',
  );
  const args = buildArgs(root, targetFile, injectedPluginFilePath, options);

  const fullCommandText = 'gradle command: ' + command + ' ' + args.join(' ');
  debugLog('Executing ' + fullCommandText);

  const stdoutText = await subProcess.execute(
    command,
    args,
    { cwd: root },
    printIfEcho,
  );
  if (cleanupCallback) {
    cleanupCallback();
  }
  const extractedJSON = extractJsonFromScriptOutput(stdoutText);
  const jsonAttrsPretty = getGradleAttributesPretty(stdoutText);
  logger(
    `The following attributes and their possible values were found in your configurations: ${jsonAttrsPretty}`,
  );

  return extractedJSON;
}

export async function getMavenPackageInfo(
  sha1: string,
  depCoords: Partial<PomCoords>,
  snykHttpClient: SnykHttpClient,
): Promise<string> {
  const { res, body } = await snykHttpClient({
    method: 'get',
    path: `/maven/coordinates/sha1/${sha1}`,
    qs: depCoords,
  });
  if (res?.statusCode >= 400 || !body || !body.ok || body.code >= 400) {
    debugLog(
      body.message ||
        `Failed to resolve ${JSON.stringify(depCoords)} using sha1 '${sha1}.`,
    );
  }
  const {
    groupId = depCoords.groupId || 'unknown',
    artifactId = depCoords.artifactId || 'unknown',
    version = depCoords.version || 'unknown',
  } = body.coordinate || {};
  return `${groupId}:${artifactId}@${version}`;
}

function splitCoordinate(coordinate: string): Partial<PomCoords> {
  const coordTest = /^[\w.-]+:[\w.-]+@[\w.-]+$/.test(coordinate);
  if (!coordTest) return {};
  const [groupId, artifactId, version] = coordinate.split(/:|@/);
  const pomCoord: Partial<PomCoords> = {};
  pomCoord.artifactId = artifactId;
  pomCoord.groupId = groupId;
  pomCoord.version = version;

  return pomCoord;
}

async function getAllDeps(
  root: string,
  targetFile: string,
  options: Options,
  snykHttpClient: SnykHttpClient,
): Promise<JsonDepsScriptResult> {
  const command = getCommand(root, targetFile);
  const gradleVersion = await getGradleVersion(root, command);
  if (gradleVersion.match(/Gradle 1/)) {
    throw new Error('Gradle 1.x is not supported');
  }

  try {
    const extractedJSON = await getAllDepsWithPlugin(root, targetFile, options);
    const versionBuildInfo = getVersionBuildInfo(gradleVersion);
    if (versionBuildInfo) {
      extractedJSON.versionBuildInfo = versionBuildInfo;
    }
    const coordinateMap: CoordinateMap = {};
    if (extractedJSON.sha1Map) {
      const getCoordinateFromHash = async (hash: string): Promise<void> => {
        const originalCoordinate = extractedJSON.sha1Map[hash];
        const depCoord = splitCoordinate(originalCoordinate);
        try {
          const coordinate = await getMavenPackageInfo(
            hash,
            depCoord,
            snykHttpClient,
          );
          coordinateMap[originalCoordinate] = coordinate;
        } catch (err) {
          debugLog(err);
        }
      };

      await pMap(Object.keys(extractedJSON.sha1Map), getCoordinateFromHash, {
        concurrency: 100,
      });
    }
    return await processProjectsInExtractedJSON(
      root,
      extractedJSON,
      coordinateMap,
    );
  } catch (err) {
    const error: Error = err;
    const gradleErrorMarkers = /^\s*>\s.*$/;
    const gradleErrorEssence = error.message
      .split('\n')
      .filter((l) => gradleErrorMarkers.test(l))
      .join('\n');

    const orange = chalk.rgb(255, 128, 0);
    const blackOnYellow = chalk.bgYellowBright.black;
    const gradleVersionOutput = orange(gradleVersion);
    let mainErrorMessage = `Error running Gradle dependency analysis.

Please ensure you are calling the \`snyk\` command with correct arguments.
If the problem persists, contact support@snyk.io, providing the full error
message from above, starting with ===== DEBUG INFORMATION START =====.`;

    // Special case for Android, where merging the configurations is sometimes
    // impossible.
    // There are no automated tests for this yet (setting up Android SDK is quite problematic).
    // See test/manual/README.md
    const jsonAttrsPretty = getGradleAttributesPretty(error.message);
    if (jsonAttrsPretty) {
      logger(
        `The following attributes and their possible values were found in your configurations: ${jsonAttrsPretty}`,
      );
    }
    if (cannotResolveVariantMarkers.find((m) => error.message.includes(m))) {
      mainErrorMessage = `Error running Gradle dependency analysis.

It seems like you are scanning an Android build with ambiguous dependency variants.
We cannot automatically resolve dependencies for such builds.

You have several options to make dependency resolution rules more specific:

1. Run Snyk CLI tool with an attribute filter, e.g.:
    ${chalk.whiteBright(
      'snyk test --all-sub-projects --configuration-attributes=buildtype:release,usage:java-runtime',
    )}

The filter will select matching attributes from those found in your configurations, use them
to select matching configuration(s) to be used to resolve dependencies. Any sub-string of the full
attribute name is enough.

Select the values for the attributes that would allow to unambiguously select the correct dependency
variant. The Gradle error message above should contain information about attributes found in
different variants.

Suggested attributes: buildtype, usage and your "flavor dimension" for Android builds.

The following attributes and their possible values were found in your configurations:
${jsonAttrsPretty}

2. Run Snyk CLI tool for specific configuration(s), e.g.:
    ${chalk.whiteBright(
      "snyk test --gradle-sub-project=my-app --configuration-matching='^releaseRuntimeClasspath$'",
    )}

(note that some configurations won't be present in every your subproject)

3. Converting your subproject dependency specifications from the form of
    ${chalk.whiteBright("implementation project(':mymodule')")}
to
    ${chalk.whiteBright(
      "implementation project(path: ':mymodule', configuration: 'default')",
    )}`;
    }

    error.message = `${chalk.red.bold(
      'Gradle Error (short):\n' + gradleErrorEssence,
    )}

${blackOnYellow('===== DEBUG INFORMATION START =====')}
${orange(gradleVersionOutput)}
${orange(error.message)}
${blackOnYellow('===== DEBUG INFORMATION END =====')}

${chalk.red.bold(mainErrorMessage)}`;
    throw error;
  }
}

export async function processProjectsInExtractedJSON(
  root: string,
  extractedJSON: JsonDepsScriptResult,
  coordinateMap?: CoordinateMap,
) {
  for (const projectId in extractedJSON.projects) {
    const { defaultProject } = extractedJSON;
    const { snykGraph, projectVersion } = extractedJSON.projects[projectId];

    if (!snykGraph) {
      continue;
    }

    const invalidValues = [null, undefined, ''];
    const isValidRootDir = invalidValues.indexOf(root) === -1;
    const isSubProject = projectId !== defaultProject;

    let projectName = isValidRootDir ? path.basename(root) : defaultProject;

    if (isSubProject) {
      projectName = isValidRootDir
        ? `${path.basename(root)}/${projectId}`
        : `${defaultProject}/${projectId}`;
    }

    extractedJSON.projects[projectId].depGraph = await buildGraph(
      snykGraph,
      projectName,
      projectVersion,
      coordinateMap,
    );
    // this property usage ends here
    delete extractedJSON.projects[projectId].snykGraph;
  }

  return extractedJSON;
}

function toCamelCase(input: string) {
  input = input
    .toLowerCase()
    .replace(/(?:(^.)|([-_\s]+.))/g, (match: string) => {
      return match.charAt(match.length - 1).toUpperCase();
    });
  return input.charAt(0).toLowerCase() + input.substring(1);
}

function getCommand(root: string, targetFile: string) {
  const isWinLocal = /^win/.test(os.platform()); // local check, can be stubbed in tests
  const quotLocal = isWinLocal ? '"' : "'";
  const wrapperScript = isWinLocal ? 'gradlew.bat' : './gradlew';
  // try to find a sibling wrapper script first
  let pathToWrapper = path.resolve(
    root,
    path.dirname(targetFile),
    wrapperScript,
  );
  if (fs.existsSync(pathToWrapper)) {
    return quotLocal + pathToWrapper + quotLocal;
  }
  // now try to find a wrapper in the root
  pathToWrapper = path.resolve(root, wrapperScript);
  if (fs.existsSync(pathToWrapper)) {
    return quotLocal + pathToWrapper + quotLocal;
  }
  return 'gradle';
}

export function formatArgWithWhiteSpace(arg: string): string {
  if (/\s/.test(arg)) {
    return quot + arg + quot;
  }
  return arg;
}

function buildArgs(
  root: string,
  targetFile: string | null,
  initGradlePath: string,
  options: Options,
) {
  const args: string[] = [];
  const taskName = options.gradleNormalizeDeps
    ? 'snykNormalizedResolvedDepsJson'
    : 'snykResolvedDepsJson';

  args.push(taskName, '-q');

  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: "' + targetFile + '"');
    }
    args.push('--build-file');

    const formattedTargetFile = formatArgWithWhiteSpace(targetFile);
    args.push(formattedTargetFile);
  }

  // Arguments to init script are supplied as properties: https://stackoverflow.com/a/48370451
  if (options['configuration-matching']) {
    args.push(
      `-Pconfiguration=${quot}${options['configuration-matching']}${quot}`,
    );
  }
  if (options['configuration-attributes']) {
    args.push(
      `-PconfAttr=${quot}${options['configuration-attributes']}${quot}`,
    );
  }

  if (options.initScript) {
    const formattedInitScript = formatArgWithWhiteSpace(
      path.resolve(options.initScript),
    );
    args.push('--init-script', formattedInitScript);
  }

  if (!options.daemon) {
    args.push('--no-daemon');
  }

  // Parallel builds can cause race conditions and multiple JSONDEPS lines in the output
  // Gradle 4.3.0+ has `--no-parallel` flag, but we want to support older versions.
  // Not `=false` to be compatible with 3.5.x: https://github.com/gradle/gradle/issues/1827
  args.push('-Dorg.gradle.parallel=');

  // Since version 4.3.0+ Gradle uses different console output mechanism. Default mode is 'auto',
  // if Gradle is attached to a terminal. It means build output will use ANSI control characters
  // to generate the rich output, therefore JSON cannot be parsed.
  args.push('-Dorg.gradle.console=plain');

  if (!api.isMultiSubProject(options)) {
    args.push('-PonlySubProject=' + (options.subProject || '.'));
  }

  args.push('-I ' + initGradlePath);

  if (options.args) {
    args.push(...options.args);
  }

  // There might be a legacy --configuration option in 'args'.
  // It has been superseded by --configuration-matching option for Snyk CLI (see buildArgs),
  // but we are handling it to support the legacy setups.
  args.forEach((a, i) => {
    // Transform --configuration=foo
    args[i] = a.replace(
      /^--configuration[= ]([a-zA-Z_]+)/,
      `-Pconfiguration=${quot}^$1$$${quot}`,
    );
    // Transform --configuration foo
    if (a === '--configuration') {
      args[i] = `-Pconfiguration=${quot}^${args[i + 1]}$${quot}`;
      args[i + 1] = '';
    }
  });

  return args;
}

async function getCallGraph(
  targetPath: string,
  command: string,
  initScriptPath?: string,
  confAttrs?: string,
  timeout?: number,
): Promise<CallGraphResult> {
  try {
    debugLog(`getting call graph from path ${targetPath}`);
    const callGraph: CallGraph = await javaCallGraphBuilder.getCallGraphGradle(
      path.dirname(targetPath),
      command,
      initScriptPath,
      confAttrs,
      timeout,
    );
    debugLog('got call graph successfully');
    return callGraph;
  } catch (e) {
    debugLog('call graph error: ' + e);
    return {
      message: e.message,
      innerError: e.innerError || e,
    };
  }
}

export const exportsForTests = {
  buildArgs,
  extractJsonFromScriptOutput,
  getVersionBuildInfo,
  toCamelCase,
  getGradleAttributesPretty,
  splitCoordinate,
  getMavenPackageInfo,
};
