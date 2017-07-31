var os = require('os');
var fs = require('fs');
var path = require('path');
var subProcess = require('./sub-process');
var parse = require('./parse-gradle');
var packageFormatVersion = 'mvn:0.0.1';

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, options) {
  if (!options) { options = { dev: false }; }

  return subProcess.execute(
    getCommand(root, targetFile),
    buildArgs(root, targetFile, options.args),
    { cwd: root })
  .then(function (result) {
    var packageName = path.basename(root);
    var packageVersion = '0.0.0';
    var from = packageName + '@' + packageVersion;
    var depTree = parse(result, from);

    return {
      plugin: {
        name: 'bundled:gradle',
        runtime: 'unknown',
      },
      package: {
        dependencies: depTree,
        name: packageName,
        version: packageVersion,
        packageFormatVersion: packageFormatVersion,
        from: [from],
      },
    };
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
  var args = ['dependencies', '-q'];
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    args.push('--build-file ' + targetFile);
  }
  if (gradleArgs) {
    args.push(gradleArgs);
  }
  return args;
}
