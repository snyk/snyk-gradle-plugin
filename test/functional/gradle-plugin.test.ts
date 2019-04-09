import {test} from 'tap';
import {exportsForTests as testableMethods} from '../../lib';
import * as os from 'os';

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : '\'';

test('check build args with array (new configuration arg)', async (t) => {
  const result = testableMethods.buildArgs(null, null, "confRegex", undefined, [
    '--build-file',
    'build.gradle',
  ]);
  t.deepEqual(result, [
    'snykResolvedDepsJson',
    '-q',
    `-Pconfiguration=${quot}confRegex${quot}`,
    '--no-daemon',
    '-Dorg.gradle.parallel=',
    '--build-file',
    'build.gradle',
  ]);
});

test('check build args with array (legacy configuration arg)', async (t) => {
  const result = testableMethods.buildArgs(null, null, undefined, undefined, [
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
});

test('check build args with string', async (t) => {
  const result = testableMethods.buildArgs(null, null, undefined, undefined,
    ['--build-file build.gradle --configuration compile']);
  t.deepEqual(result, [
    'snykResolvedDepsJson',
    '-q',
    '--no-daemon',
    '-Dorg.gradle.parallel=',
    '--build-file build.gradle --configuration compile',
  ]);
});

test('extractJsonFromScriptOutput', async (t) => {
  const result = testableMethods.extractJsonFromScriptOutput(`Mr Gradle says hello
la dee da, la dee da
JSONDEPS {"hello": "world"}
some other noise`);
  t.deepEqual(result, {hello: 'world'});
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
