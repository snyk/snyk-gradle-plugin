var os = require('os');
var fs = require('fs');
var path = require('path');
var subProcess = require('./sub-process');
var packageFormatVersion = 'mvn:0.0.1';

module.exports = {
  inspect: inspect,
};

module.exports.__tests = {
  buildArgs: buildArgs,
  extractJsonFromScriptOutput: extractJsonFromScriptOutput,
};

function inspect(root, targetFile, options) {
  if (!options) {
    options = {dev: false};
  }
  var subProject = options['gradle-sub-project'];
  return getAllDeps(root, targetFile, options, subProject)
    .then(function (pkg) {
      return {
        plugin: {
          name: 'bundled:gradle',
          runtime: 'unknown',
          targetFile: (path.basename(targetFile) === 'build.gradle.kts') ? targetFile : undefined,
        },
        package: pkg,
      };
    });
}

function extractJsonFromScriptOutput(stdoutText) {
  var lines = stdoutText.split('\n');
  var jsonLine = null;
  lines.forEach(function(l) {
    if (l.startsWith('JSONDEPS ')) {
      if (jsonLine !== null) {
        throw new Error('More than one line with JSONDEPS prefix was returned');
      }
      jsonLine = l.substr(9);
    }
  });
  return JSON.parse(jsonLine);
}

function getAllDeps(root, targetFile, options, subProject) {
  var args = buildArgs(root, targetFile, options.args);

  // TODO: move to buildArgs, adjust tests
  args.push('-I ' + path.join(__dirname, 'init.gradle'));

  // There might be a --configuration option in 'args'.
  // We need to convert it to a property: https://stackoverflow.com/a/48370451

  // TODO: (in snyk-cli) move `configuration` to `options`, disallow arbitrary args,
  // pin down `options` format via Typescript

  args.forEach((a, i) => {
    // Transform --configuration=foo
    args[i] = a.replace(/^--configuration[= ]/, '-Pconfiguration=');
    // Transform --configuration foo
    if (a === '--configuration') {
      args[i] = '-Pconfiguration=' + args[i+1];
      args[i+1] = '';
    }
  });

  var command = getCommand(root, targetFile);
  return subProcess.execute(
    command,
    args,
    {cwd: root})
    // Go to parser + become a tree
    .then(function (stdoutText) {
      var allProjectDeps = extractJsonFromScriptOutput(stdoutText);
      var packageName = path.basename(root);
      var depTree = {};
      if (subProject) {
        packageName += '/' + subProject;
        depTree = allProjectDeps[subProject];
      } else {
        depTree = allProjectDeps[allProjectDeps['$rootProject']];
      }
      var packageVersion = '0.0.0';
      return {
        dependencies: depTree,
        name: packageName,
        version: packageVersion,
        packageFormatVersion: packageFormatVersion,
      };
    })
    .catch(function (error) {
      error.message = error.message + '\n\n' +
        'Please make sure that `' + command + ' ' + args.join(' ') +
        '` executes successfully on this project.\n\n' +
        'If the problem persists, collect the output of `' +
        command + ' ' + args.join(' ') + '` and contact support@snyk.io\n';
      throw error;
    });
}

function getCommand(root, targetFile) {
  var isWin = /^win/.test(os.platform());
  var wrapperScript = isWin ? 'gradlew.bat' : './gradlew';
  // try to find a sibling wrapper script first
  var pathToWrapper = path.resolve(
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

function buildArgs(root, targetFile, gradleArgs) {
  var args = [];
  args.push('snykResolvedDepsJson', '-q');
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: "' + targetFile + '"');
    }
    args.push('--build-file');

    var formattedTargetFile = targetFile;
    if (/\s/.test(targetFile)) { // checking for whitespaces
      var isWin = /^win/.test(os.platform());
      var quot = isWin ? '"' : '\'';
      formattedTargetFile = quot + targetFile + quot;
    }
    args.push(formattedTargetFile);
  }

  // For some reason, this is not required for Unix, but on Windows, without this flag, apparently,
  // Gradle process just never exits, from the Node's standpoint.
  args.push('--no-daemon');

  if (gradleArgs) {
    args = args.concat(gradleArgs);
  }
  return args;
}
