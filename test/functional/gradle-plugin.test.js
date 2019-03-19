var test = require('tap').test;
var plugin = require('../../lib').__tests;

test('check build args with array', function (t) {
  t.plan(1);
  var result = plugin.buildArgs(null, null, [
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.deepEqual(result, [
    'dependencies',
    '-q',
    '--no-daemon',
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.end();
});

test('check build args with string', function (t) {
  t.plan(1);
  var result = plugin.buildArgs(null, null,
    '--build-file build.gradle --configuration compile');
  t.deepEqual(result, [
    'dependencies',
    '-q',
    '--no-daemon',
    '--build-file build.gradle --configuration compile',
  ]);
  t.end();
});
