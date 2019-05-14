import {test} from 'tap';
import {exportsForTests as testableMethods} from '../../lib';

test('check build args with array', (t) => {
  t.plan(1);
  const result = testableMethods.buildArgs(null, null, [
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.deepEqual(result, [
    'snykResolvedDepsJson',
    '-q',
    '--no-daemon',
    '-Dorg.gradle.parallel=',
    '--build-file',
    'build.gradle',
    '--configuration',
    'compile',
  ]);
  t.end();
});

test('check build args with string', (t) => {
  t.plan(1);
  const result = testableMethods.buildArgs(null, null,
    ['--build-file build.gradle --configuration compile']);
  t.deepEqual(result, [
    'snykResolvedDepsJson',
    '-q',
    '--no-daemon',
    '-Dorg.gradle.parallel=',
    '--build-file build.gradle --configuration compile',
  ]);
  t.end();
});

test('extractJsonFromScriptOutput', (t) => {
  t.plan(1);
  const result = testableMethods.extractJsonFromScriptOutput(`Mr Gradle says hello
la dee da, la dee da
JSONDEPS {"hello": "world"}
some other noise`);
  t.deepEqual(result, {hello: 'world'});
  t.end();
});

test('extractJsonFromScriptOutput throws on no JSONDEPS', async (t) => {
  const output = 'something else entirely';
  try{
    testableMethods.extractJsonFromScriptOutput(output);
    t.fail('Error expected');
  } catch (e) {
    t.match(e.message, 'No line prefixed with "JSONDEPS " was returned', 'expected error message');
    t.match(e.message, output, 'error message contains output');
  }
});

test('extractJsonFromScriptOutput throws on multiple JSONDEPS', async (t) => {
  const output = 'JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]';
  try{
    testableMethods.extractJsonFromScriptOutput(output);
    t.fail('Error expected');
  } catch (e) {
    t.match(e.message, 'More than one line with "JSONDEPS " prefix was returned', 'expected error message');
    t.match(e.message, output, 'error message contains output');
  }
});
