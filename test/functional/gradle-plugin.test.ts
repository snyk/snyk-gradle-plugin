import {test} from 'tap';
import {__tests as plugin} from '../../lib';

test('check build args with array', function (t) {
  t.plan(1);
  var result = plugin.buildArgs(null, null, [
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.deepEqual(result, [
    'snykResolvedDepsJson',
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
    'snykResolvedDepsJson',
    '-q',
    '--no-daemon',
    '--build-file build.gradle --configuration compile',
  ]);
  t.end();
});

test('extractJsonFromScriptOutput', function (t) {
  t.plan(1);
  var result = plugin.extractJsonFromScriptOutput(`Mr Gradle says hello
la dee da, la dee da
JSONDEPS {"hello": "world"}
some other noise`);
  t.deepEqual(result, {hello: 'world'});
  t.end();
});

test('extractJsonFromScriptOutput throws on JSONDEPS', function (t) {
  t.plan(1);
  t.throws(function() {
    plugin.extractJsonFromScriptOutput('JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]');
  });
});
