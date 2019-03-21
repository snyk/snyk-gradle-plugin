import * as os from 'os';
import * as fs from 'fs';
import * as  path from 'path';
import * as subProcess from './sub-process';

const packageFormatVersion = 'mvn:0.0.1';

export interface SingleProjectResult {
  plugin: PluginMetadata;
  package: DepTree;
}

// TODO(kyegupov): extract to snyk-plugin-common
interface PluginMetadata {
  name: string;
  runtime: string;
  targetFile?: string;
}

interface JsonDepsScriptResult {
  rootProject: string;
  projects: ProjectsDict;
}

interface ProjectsDict {
  [project: string]: DepDict;
}

interface DepDict {
  [name: string]: DepTree;
}

interface DepTree {
  name: string;
  version: string;
  dependencies?: DepDict;
  packageFormatVersion?: string;
}

export async function inspect(root, targetFile, options?): Promise<SingleProjectResult> {
  if (!options) {
    options = {dev: false};
  }
  const subProject = options['gradle-sub-project'];
  const pkg = await getAllDeps(root, targetFile, options, subProject);
  return {
    plugin: {
      name: 'bundled:gradle',
      runtime: 'unknown',
      targetFile: (path.basename(targetFile) === 'build.gradle.kts') ? targetFile : undefined,
    },
    package: pkg,
  };
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

async function getAllDeps(root, targetFile, options, subProject): Promise<DepTree> {
  const args = buildArgs(root, targetFile, options.args);

  // TODO: move to buildArgs, adjust tests
  let initGradlePath: string | null = null;
  if (/index.js$/.test(__filename)) {
    // running from ./dist/lib
    initGradlePath = path.join(__dirname, '../../lib/init.gradle');
  } else if (/index.ts$/.test(__filename)) {
    // running from ./lib
    initGradlePath = path.join(__dirname, 'init.gradle');
  } else {
    throw new Error('Cannot locate Snyk init.gradle script');
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
    const allProjectDeps = extractJsonFromScriptOutput(stdoutText);
    let packageName = path.basename(root);
    let depTree = {} as DepDict;
    if (subProject) {
      packageName += '/' + subProject;
      depTree = allProjectDeps.projects[subProject];
    } else {
      depTree = allProjectDeps.projects[allProjectDeps.rootProject];
    }
    const packageVersion = '0.0.0';
    return {
      dependencies: depTree,
      name: packageName,
      version: packageVersion,
      packageFormatVersion,
    };
  } catch (error) {
    error.message = error.message + '\n\n' +
      'Please make sure that `' + command + ' ' + args.join(' ') +
      '` executes successfully on this project.\n\n' +
      'If the problem persists, collect the output of `' +
      command + ' ' + args.join(' ') + '` and contact support@snyk.io\n';
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

  if (gradleArgs) {
    args.push(...gradleArgs);
  }
  return args;
}

export const exportsForTests = {
  buildArgs,
  extractJsonFromScriptOutput,
};
