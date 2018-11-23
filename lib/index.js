var os = require('os');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('snyk');
var subProcess = require('./sub-process');
var depParser = require('./gradle-dep-parser');
var jarParser = require('./gradle-jar-parser');
var pluginParser = require('./gradle-plugin-parser');
var packageFormatVersion = 'mvn:0.0.1';

module.exports = {
  inspect: inspect,
};

module.exports.__tests = {
  buildArgs: buildArgs,
};

function inspect(root, targetFile, options) {
  if (!options) {
    options = {dev: false};
  }
  var command =  getCommand(root, targetFile);
  var subProject = options['gradle-sub-project'];
  var args;
  return setGradleConfiguration(root, targetFile, options)
    .then(function () {
      // options.args may have been mutated, now is the right time
      // to build the dependency-checking command args
      args = buildArgs(root, targetFile, options.args, subProject);
      return getPackage(root, command, args, subProject);
    })
    .then(function (pkg) {
    // opt-in with `jars` or `localjars` flag
      if (options.jars || options.localjars) {
        return getJarList(root, targetFile, options)
          .then(function (jars) {
            if (jars && jars.length) {
              pkg.jars = jars;
            }
            return pkg;
          });
      }
      return pkg;
    })
    .then(function (pkg) {
      return {
        plugin: {
          name: 'bundled:gradle',
          runtime: 'unknown',
        },
        package: pkg,
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

function getPackage(root, command, args, subProject) {
  return subProcess.execute(command, args, {cwd: root})
    .then(function (result) {
      var packageName = path.basename(root);
      if (subProject) {
        packageName += '/' + subProject;
      }
      var packageVersion = '0.0.0';
      var depTree = depParser.parse(result);
      return {
        dependencies: depTree,
        name: packageName,
        version: packageVersion,
        packageFormatVersion: packageFormatVersion,
      };
    });
}

function getJarList(root, targetFile, options) {
  var args = buildArgs(root, targetFile, options.args);
  args.shift(); // remove `dependencies` arg
  args.push('-I ' + path.join(__dirname, 'init.gradle'));
  args.push(options.jars ? 'listAllJars' : 'listLocalJars');
  return subProcess.execute(
    getCommand(root, targetFile),
    args,
    {cwd: root})
    .then(jarParser.parse);
}

function getPluginList(root, targetFile) {
  var args = buildArgs(root, targetFile);
  args.shift(); // remove `dependencies` arg
  args.push('-I ' + path.join(__dirname, 'init.gradle'), 'listAllPlugins');
  return subProcess.execute(
    getCommand(root, targetFile),
    args,
    {cwd: root})
    .then(pluginParser.parse);
}

// make sure `options.args` includes the right gradle configuration.
// mutates `options`!
function setGradleConfiguration(root, targetFile, options) {
  // Gradle configurations are subtle and very important
  // with regards to dependencies. Choose as follows:
  // 1. If `options.args` specifies a configuration, leave it as is.
  // 2. Check for gradle plugins. If the 'java' plugin is used,
  //    use the `default` configuration.
  // 3. No explicit configuration in args, first configuration will be chosen!
  var configurationArgIndex =
    options.args && options.args.indexOf('--configuration');
  if (configurationArgIndex !== undefined && configurationArgIndex >= 0) {
    debug('Using explicit gradle configuration',
      options.args[configurationArgIndex + 1]);
    return Promise.resolve();
  }

  return getPluginList(root, targetFile)
    .then(function (plugins) {
      var hasJavaPlugin = plugins && plugins.some(function (plugin) {
        return plugin.startsWith('org.gradle.api.plugins.JavaPlugin');
      });
      if (hasJavaPlugin) {
        options.args = options.args || [];
        options.args.push('--configuration', 'default');
        debug('Java plugin detected, using default gradle configuration');
      } else {
        debug('Java plugin not detected, ' +
          'not using any explicit gradle configuration');
      }
    })
    .catch(function (error) {
      debug('Error while checking for java plugin', error);
      debug('Not using any explicit gradle configuration');
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

function buildArgs(root, targetFile, gradleArgs, subProject) {
  var args = [];
  if (subProject) {
    args.push(subProject + ':dependencies');
  } else {
    args.push('dependencies');
  }
  args.push('-q');
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    args.push('--build-file');
    args.push(targetFile);
  }
  if (gradleArgs) {
    args = args.concat(gradleArgs);
  }
  return args;
}
