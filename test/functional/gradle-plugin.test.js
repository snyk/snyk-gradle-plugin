var test = require('tap-only');
var plugin = require('../../lib').__tests;

test('check build args with array', function (t) {
  var result = plugin.buildArgs(null, null, [
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.deepEqual(result, [
    'dependencies',
    '-q',
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.end();
});

test('check build args with string', function (t) {
  var result = plugin.buildArgs(null, null,
    '--build-file build.gradle --configuration compile');
  t.deepEqual(result, [
    'dependencies',
    '-q',
    '--build-file build.gradle --configuration compile',
  ]);
  t.end();
});
