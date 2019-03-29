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
    '-Dorg.gradle.parallel=false',
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
    '-Dorg.gradle.parallel=false',
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

test('extractJsonFromScriptOutput throws on multiple JSONDEPS', (t) => {
  t.plan(1);
  t.throws(() => {
    testableMethods.extractJsonFromScriptOutput('JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]');
  });
});
