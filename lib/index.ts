import * as os from 'os';
import * as fs from 'fs';
import * as  path from 'path';
import * as subProcess from './sub-process';
import * as tmp from 'tmp';
import {MissingSubProjectError} from './errors';
import chalk from 'chalk';
import debugModule = require('debug');

// To enable debugging output, run the CLI as `DEBUG=snyk-gradle-plugin snyk ...`
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

const packageFormatVersion = 'mvn:0.0.1';

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : '\'';

// TODO(kyegupov): the types below will be extracted to a common plugin interface library

export interface BaseInspectOptions {
  dev?: boolean;

  // A regular expression (Java syntax, case-insensitive) to select Gradle configurations.
  // If only one configuration matches, its attributes will be used for dependency resolution;
  // otherwise, an artificial merged configuration will be created (see configuration-attributes
  // below).
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  'configuration-matching'?: string;

  // A comma-separated list of key:value pairs, e.g. "buildtype=release,usage=java-runtime".
  // If specified, will scan all configurations for attributes with names that contain "keys" (case-insensitive)
  // and have values that have a string representation that match the specified one, and will copy
  // these attributes into the merged configuration.
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  'configuration-attributes'?: string;

  // Additional command line arguments to Gradle, supplied after "--" to the Snyk CLI.
  // E.g. legacy --configuration=foo (see configuration-matching instead)
  args?: string[];

}

// The return type of inspect() depends on the multiDepRoots flag.

export interface SingleRootInspectOptions extends BaseInspectOptions {
  // Return the information not on the main project, but on the specific subproject defined in the build.
  'gradle-sub-project'?: string;
}

export interface MultiRootsInspectOptions extends BaseInspectOptions {
  // Return multiple "dependency roots" as a MultiDepRootsResult.
  // Dep roots correspond to sub-projects in Gradle or projects in a Yark workspace.
  // Eventually, this flag will be an implicit default.
  // For now, plugins return SingleDepRootResult by default.

  // TODO(kyegupov): this should be renamed to allSubProjects,
  // see https://github.com/snyk/snyk-cli-interface/blob/master/lib/legacy/plugin.ts
  multiDepRoots: true;
}

function isMultiSubProject(options: SingleRootInspectOptions | MultiRootsInspectOptions):
    options is MultiRootsInspectOptions {
  return (options as MultiRootsInspectOptions).multiDepRoots;
}

// Legacy result type. Will be deprecated soon.
export interface SingleDepRootResult {
  plugin: PluginMetadata;
  package: DepTree;
}

export interface MultiDepRootsResult {
  plugin: PluginMetadata;
  depRoots: DepRoot[];
}

export interface PluginMetadata {
  name: string;
  runtime: string;

  // TODO(BST-542): remove, DepRoot.targetFile to be used instead
  // Note: can be missing, see targetFileFilteredForCompatibility
  targetFile?: string;

  // Plugin-specific metadata
  meta?: {
    // If we don't return the results for all dependency roots (subprojects),
    // still record their names to warn the user about them not being scanned
    allSubProjectNames?: string[];
  };
}

export interface DepDict {
  [name: string]: DepTree;
}

// TODO(BST-542): proper name should be decided.
// This is essentially a "dependency root and associated dependency graph".
// Possible name: DiscoveryResult, Inspectable, or maybe stick with DepRoot
export interface DepRoot {
  depTree: DepTree; // to be soon replaced with depGraph

  // this will eventually become a structure (list) of "build" files,
  // also known as "project roots".
  // Note: can be missing, see targetFileFilteredForCompatibility
  targetFile?: string;

  meta?: any; // TODO(BST-542): decide on the format
}

export interface DepTree {
  name: string;
  version: string;
  dependencies?: DepDict;
  packageFormatVersion?: string;
}

export async function inspect(root, targetFile, options?: SingleRootInspectOptions): Promise<SingleDepRootResult>;
export async function inspect(root, targetFile, options: MultiRootsInspectOptions): Promise<MultiDepRootsResult>;

export async function inspect(root, targetFile, options?: SingleRootInspectOptions | MultiRootsInspectOptions):
  Promise<SingleDepRootResult | MultiDepRootsResult> {
  if (!options) {
    options = {dev: false};
  }
  let subProject = options['gradle-sub-project'];
  if (subProject) {
    subProject = subProject.trim();
  }
  const plugin: PluginMetadata = {
    name: 'bundled:gradle',
    runtime: 'unknown',
    targetFile: targetFileFilteredForCompatibility(targetFile),
  };
  if (isMultiSubProject(options)) {
    if (subProject) {
      throw new Error('gradle-sub-project flag is incompatible with multiDepRoots');
    }
    return {
      plugin,
      depRoots: await getAllDepsAllProjects(root, targetFile, options),
    };
  }
  const depTreeAndDepRootNames = await getAllDepsOneProject(root, targetFile, options, subProject);
  if (depTreeAndDepRootNames.allSubProjectNames) {
    plugin.meta = plugin.meta || {};
    plugin.meta.allSubProjectNames = depTreeAndDepRootNames.allSubProjectNames;
  }
  return {
    plugin,
    package: depTreeAndDepRootNames.depTree,
  };
}

// See the comment for DepRoot.targetFile
// Note: for Gradle, we are not returning the name unless it's a .kts file.
// This is a workaround for a project naming problem happening in Registry
// (legacy projects are named without "build.gradle" attached to them).
// See ticket BST-529 re permanent solution.
function targetFileFilteredForCompatibility(targetFile: string): string | undefined {
  return (path.basename(targetFile) === 'build.gradle.kts') ? targetFile : undefined;
}

interface JsonDepsScriptResult {
  defaultProject: string;
  projects: ProjectsDict;
  allSubProjectNames: string[];
}

interface ProjectsDict {
  [project: string]: GradleProjectInfo;
}

interface GradleProjectInfo {
  depDict: DepDict;
  targetFile: string;
}

function extractJsonFromScriptOutput(stdoutText: string): JsonDepsScriptResult {
  const lines = stdoutText.split('\n');
  let jsonLine: string | null = null;
  lines.forEach((l) => {
    if (/^JSONDEPS /.test(l)) {
      if (jsonLine !== null) {
        throw new Error('More than one line with "JSONDEPS " prefix was returned; full output:\n' + stdoutText);
      }
      jsonLine = l.substr(9);
    }
  });
  if (jsonLine === null) {
    throw new Error('No line prefixed with "JSONDEPS " was returned; full output:\n' + stdoutText);
  }
  return JSON.parse(jsonLine!);
}

async function getAllDepsOneProject(root, targetFile, options, subProject):
    Promise<{depTree: DepTree, allSubProjectNames: string[]}> {
  const packageName = path.basename(root);
  const allProjectDeps = await getAllDeps(root, targetFile, options);
  const allSubProjectNames = allProjectDeps.allSubProjectNames;
  let depDict = {} as DepDict;
  if (subProject) {
    return {
      depTree: getDepsSubProject(root, subProject, allProjectDeps),
      allSubProjectNames,
    };
  }

  depDict = allProjectDeps.projects[allProjectDeps.defaultProject].depDict;

  return {
    depTree: {
      dependencies: depDict,
      name: packageName,
      // TODO: extract from project
      // https://snyksec.atlassian.net/browse/BST-558
      version: '0.0.0',
      packageFormatVersion,
    },
    allSubProjectNames,
  };
}

function getDepsSubProject(root, subProject, allProjectDeps) {
  const packageName = `${path.basename(root)}/${subProject}`;
  let depDict = {} as DepDict;

  if (!allProjectDeps.projects || !allProjectDeps.projects[subProject]) {
    throw new MissingSubProjectError(subProject, Object.keys(allProjectDeps));
  }

  depDict = allProjectDeps.projects[subProject].depDict;

  return {
    dependencies: depDict,
    name: packageName,
    // TODO: extract from project
    // https://snyksec.atlassian.net/browse/BST-558
    version: '0.0.0',
    packageFormatVersion,
  };
}
async function getAllDepsAllProjects(root, targetFile, options): Promise<DepRoot[]> {
  const allProjectDeps = await getAllDeps(root, targetFile, options);
  const basePackageName = path.basename(root);
  const packageVersion = '0.0.0';
  return Object.keys(allProjectDeps.projects).map((proj) => {
    const packageName = proj === allProjectDeps.defaultProject ? basePackageName : basePackageName + '/' + proj;
    return {
      targetFile: targetFileFilteredForCompatibility(allProjectDeps.projects[proj].targetFile),
      depTree: {
        dependencies: allProjectDeps.projects[proj].depDict,
        name: packageName,
        version: packageVersion,
        packageFormatVersion,
      },
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

// <insert a npm left-pad joke here>
function leftPad(s: string, n: number) {
  return ' '.repeat(Math.max(n - s.length, 0)) + s;
}

async function getAllDeps(root, targetFile, options: SingleRootInspectOptions | MultiRootsInspectOptions):
    Promise<JsonDepsScriptResult> {
  const args = buildArgs(
    root, targetFile,
    options['configuration-matching'],
    options['configuration-attributes'],
    options.args);

  let tmpInitGradle: tmp.SynchrounousResult | null = null;

  // TODO: move to buildArgs, adjust tests
  let initGradlePath: string | null = null;
  if (/index.js$/.test(__filename)) {
    // running from ./dist
    initGradlePath = path.join(__dirname, '../lib/init.gradle');
  } else if (/index.ts$/.test(__filename)) {
    // running from ./lib
    initGradlePath = path.join(__dirname, 'init.gradle');
  } else {
    throw new Error('Cannot locate Snyk init.gradle script');
  }

  // We could be running from a bundled CLI generated by `pkg`.
  // The Node filesystem in that case is not real: https://github.com/zeit/pkg#snapshot-filesystem
  // Copying the injectable script into a temp file.
  try {
    tmpInitGradle = tmp.fileSync({postfix: '-init.gradle'});
    await fs.createReadStream(initGradlePath).pipe(fs.createWriteStream('', {fd: tmpInitGradle!.fd}));
    initGradlePath = tmpInitGradle.name;
  }  catch (error) {
    error.message = error.message + '\n\n' +
      'Failed to create a temporary file to host Snyk init script for Gradle build analysis.';
    throw error;
  }

  if (!isMultiSubProject(options)) {
    args.push('-PonlySubProject=' + (options['gradle-sub-project'] || '.'));
  }

  args.push('-I ' + initGradlePath);

  // There might be a legacy --configuration option in 'args'.
  // It has been superseded by --configurationMatching option for Snyk CLI (see buildArgs),
  // but we are handling it to support the legacy setups.
  args.forEach((a, i) => {
    // Transform --configuration=foo
    args[i] = a.replace(/^--configuration[= ]([a-zA-Z_])+/, `-Pconfiguration=${quot}^$1$$${quot}`);
    // Transform --configuration foo
    if (a === '--configuration') {
      args[i] = `-Pconfiguration=${quot}^${args[i + 1]}$${quot}`;
      args[i + 1] = '';
    }
  });

  const command = getCommand(root, targetFile);
  try {
    const stdoutText = await subProcess.execute(command, args, {cwd: root}, printIfEcho);
    if (tmpInitGradle !== null) {
      tmpInitGradle.removeCallback();
    }
    return extractJsonFromScriptOutput(stdoutText);
  } catch (error0) {
    const error: Error = error0;
    const gradleErrorMarkers = /^\s*>\s.*$/;
    const gradleErrorEssence = error.message.split('\n').filter((l) => gradleErrorMarkers.test(l)).join('\n');

    // It'd be nice to set it in the inner catch{} block below.
    // However, it's not safe: the inner catch{} will be executed even it inner try{}
    // succeeds. Seems like an async/await implementation problem.
    let gradleVersionOutput = '[COULD NOT RUN gradle -v] ';
    try {
      gradleVersionOutput = await subProcess.execute(command, ['-v'], {cwd: root});
    } catch (_) {
      // intentionally empty
    }
    const orange = chalk.rgb(255, 128, 0);
    const blackOnYellow = chalk.bgYellowBright.black;
    gradleVersionOutput = orange(gradleVersionOutput);
    let mainErrorMessage = `Error running Gradle dependency analysis.

Please ensure you are calling the \`snyk\` command with correct arguments.
If the problem persists, contact support@snyk.io, providing the full error
message from above, starting with ===== DEBUG INFORMATION START =====.`;

    // Special case for Android, where merging the configurations is sometimes
    // impossible.
    // There are no automated tests for this yet (setting up Android SDK is quite problematic).
    // See test/manual/README.md

    if (/Cannot choose between the following/.test(error.message)
      || /Could not select value from candidates/.test(error.message)) {

        // Extract attribute information via JSONATTRS marker:
        const jsonAttrs = JSON.parse(
          (error.message as string).split('\n').filter((line) => /^JSONATTRS /.test(line))[0].substr(10),
        );
        const attrNameWidth = Math.max(...Object.keys(jsonAttrs).map((name) => name.length));
        const jsonAttrsPretty = Object.keys(jsonAttrs).map(
          (name) => chalk.whiteBright(leftPad(name, attrNameWidth)) + ': ' + chalk.gray(jsonAttrs[name].join(', ')),
        ).join('\n');

        mainErrorMessage = `Error running Gradle dependency analysis.

It seems like you are scanning an Android build with ambiguous dependency variants.
We cannot automatically resolve dependencies for such builds.

You have several options to make dependency resolution rules more specific:

1. Run Snyk CLI tool with an attribute filter, e.g.:
    ${chalk.whiteBright('snyk test --all-sub-projects --configuration-attributes=buildtype:release,usage:java-runtime')}

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
    ${chalk.whiteBright("snyk test --gradle-sub-project=my-app --configuration-matching='^releaseRuntimeClasspath$'")}

(note that some configurations won't be present in every your subproject)

3. Converting your subproject dependency specifications from the form of
    ${chalk.whiteBright("implementation project(':mymodule')")}
to
    ${chalk.whiteBright("implementation project(path: ':mymodule', configuration: 'default')")}`;
    }

    const fullCommandText = 'gradle command: ' + command + ' ' + args.join(' ');
    error.message = `${chalk.red.bold('Gradle Error (short):\n' + gradleErrorEssence)}

${blackOnYellow('===== DEBUG INFORMATION START =====')}
${orange(fullCommandText)}
${orange(gradleVersionOutput)}
${orange(error.message)}
${blackOnYellow('===== DEBUG INFORMATION END =====')}

${chalk.red.bold(mainErrorMessage)}`;
    throw error;
  }
}

function getCommand(root, targetFile) {
  const isWinLocal = /^win/.test(os.platform()); // local check, can be stubbed in tests
  const quotLocal = isWinLocal ? '"' : '\'';
  const wrapperScript = isWinLocal ? 'gradlew.bat' : './gradlew';
  // try to find a sibling wrapper script first
  let pathToWrapper = path.resolve(
    root, path.dirname(targetFile), wrapperScript);
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

function buildArgs(
    root, targetFile,
    configurationMatching: string|undefined,
    configurationAttributes: string|undefined,
    gradleArgs?: string[]) {
  const args: string[] = [];
  args.push('snykResolvedDepsJson', '-q');
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: "' + targetFile + '"');
    }
    args.push('--build-file');

    let formattedTargetFile = targetFile;
    if (/\s/.test(targetFile)) { // checking for whitespaces
      formattedTargetFile = quot + targetFile + quot;
    }
    args.push(formattedTargetFile);
  }

  // Arguments to init script are supplied as properties: https://stackoverflow.com/a/48370451
  if (configurationMatching) {
    args.push(`-Pconfiguration=${quot}${configurationMatching}${quot}`);
  }
  if (configurationAttributes) {
    args.push(`-PconfAttr=${quot}${configurationAttributes}${quot}`);
  }

  // For some reason, this is not required for Unix, but on Windows, without this flag, apparently,
  // Gradle process just never exits, from the Node's standpoint.
  args.push('--no-daemon');

  // Parallel builds can cause race conditions and multiple JSONDEPS lines in the output
  // Gradle 4.3.0+ has `--no-parallel` flag, but we want to support older versions.
  // Not `=false` to be compatible with 3.5.x: https://github.com/gradle/gradle/issues/1827
  args.push('-Dorg.gradle.parallel=');

  if (gradleArgs) {
    args.push(...gradleArgs);
  }
  return args;
}

export const exportsForTests = {
  buildArgs,
  extractJsonFromScriptOutput,
};
