import * as os from 'os';
import * as fs from 'fs';
import * as  path from 'path';
import * as subProcess from './sub-process';
import * as tmp from 'tmp';
import {MissingSubProjectError} from './errors';
import chalk from 'chalk';

const packageFormatVersion = 'mvn:0.0.1';

// TODO(kyegupov): the types below will be extracted to a common plugin interface library

export interface BaseInspectOptions {
  dev?: boolean;

  // Additional command line arguments to Gradle, supplied after "--" to the Snyk CLI.
  // E.g. --configuration=foo
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
  multiDepRoots: true;
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
  const plugin = {
    name: 'bundled:gradle',
    runtime: 'unknown',
    targetFile: targetFileFilteredForCompatibility(targetFile),
  };
  if ((options as MultiRootsInspectOptions).multiDepRoots) {
    if (subProject) {
      throw new Error('gradle-sub-project flag is incompatible with multiDepRoots');
    }
    return {
      plugin,
      depRoots: await getAllDepsAllProjects(root, targetFile, options),
    };
  }
  return {
    plugin,
    package: await getAllDepsOneProject(root, targetFile, options, subProject),
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
        throw new Error('More than one line with "JSONDEPS " prefix was returned');
      }
      jsonLine = l.substr(9);
    }
  });
  if (jsonLine === null) {
    throw new Error('No line prefixed with "JSONDEPS " was returned');
  }
  return JSON.parse(jsonLine!);
}

async function getAllDepsOneProject(root, targetFile, options, subProject): Promise<DepTree> {
  const packageName = path.basename(root);
  const allProjectDeps = await getAllDeps(root, targetFile, options);
  let depDict = {} as DepDict;
  if (subProject) {
    return getDepsSubProject(root, subProject, allProjectDeps);
  }

  depDict = allProjectDeps.projects[allProjectDeps.defaultProject].depDict;

  return {
    dependencies: depDict,
    name: packageName,
    // TODO: extract from project
    // https://snyksec.atlassian.net/browse/BST-558
    version: '0.0.0',
    packageFormatVersion,
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

async function getAllDeps(root, targetFile, options): Promise<JsonDepsScriptResult> {
  const args = buildArgs(root, targetFile, options.args);

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

  args.push('-I ' + initGradlePath);

  // There might be a --configuration option in 'args'.
  // We need to convert it to a property: https://stackoverflow.com/a/48370451

  // TODO: (in snyk-cli) move `configuration` to `options`, disallow arbitrary args,
  // pin down `options` format via Typescript

  args.forEach((a, i) => {
    // Transform --configuration=foo
    args[i] = a.replace(/^--configuration[= ]/, '-Pconfiguration=');
    // Transform --configuration foo
    if (a === '--configuration') {
      args[i] = '-Pconfiguration=' + args[i + 1];
      args[i + 1] = '';
    }
  });

  const command = getCommand(root, targetFile);
  try {
    const stdoutText = await subProcess.execute(command, args, {cwd: root});
    if (tmpInitGradle !== null) {
      tmpInitGradle.removeCallback();
    }
    return extractJsonFromScriptOutput(stdoutText);
  } catch (error) {
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
    const subProcessError = orange(error.message);
    let mainErrorMessage = `Error running Gradle dependency analysis.

Please ensure you are calling the \`snyk\` command with correct arguments.
If the problem persists, contact support@snyk.io, providing the full error
message from above, starting with ===== DEBUG INFORMATION START =====.`;

    // Special case for Android, where merging the configurations is sometimes
    // impossible.
    // There are no automated tests for this yet (setting up Android SDK is quite problematic).
    // See test/manual/README.md

    if (/Cannot choose between the following configurations/.test(error.message)
      || /Could not select value from candidates/.test(error.message)) {
        mainErrorMessage = `Error running Gradle dependency analysis.

It seems like you are scanning an Android build with ambiguous dependency variants.
We cannot automatically resolve dependencies for such builds.

We recommend converting your subproject dependency specifications from the form of
    implementation project(":mymodule")
to
    implementation project(path: ':mymodule', configuration: 'default')
or running Snyk CLI tool for a specific configuration, e.g.:
    snyk test --all-sub-projects -- --configuration=releaseRuntimeClasspath`;
    }

    error.message = `${blackOnYellow('===== DEBUG INFORMATION START =====')}
${orange(gradleVersionOutput)}
${orange(error.message)}
${blackOnYellow('===== DEBUG INFORMATION END =====')}

${chalk.red.bold(mainErrorMessage)}`;
    throw error;
  }
}

function getCommand(root, targetFile) {
  const isWin = /^win/.test(os.platform());
  const wrapperScript = isWin ? 'gradlew.bat' : './gradlew';
  // try to find a sibling wrapper script first
  let pathToWrapper = path.resolve(
    root, path.dirname(targetFile), wrapperScript);
  if (fs.existsSync(pathToWrapper)) {
    return pathToWrapper;
  }
  // now try to find a wrapper in the root
  pathToWrapper = path.resolve(root, wrapperScript);
  if (fs.existsSync(pathToWrapper)) {
    return pathToWrapper;
  }
  return 'gradle';
}

function buildArgs(root, targetFile, gradleArgs: string[]) {
  const args: string[] = [];
  args.push('snykResolvedDepsJson', '-q');
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: "' + targetFile + '"');
    }
    args.push('--build-file');

    let formattedTargetFile = targetFile;
    if (/\s/.test(targetFile)) { // checking for whitespaces
      const isWin = /^win/.test(os.platform());
      const quot = isWin ? '"' : '\'';
      formattedTargetFile = quot + targetFile + quot;
    }
    args.push(formattedTargetFile);
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
