// import { test } from 'tap';
import { exportsForTests as testableMethods } from '../../lib';
import * as os from 'os';

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : "'";

describe('', () => {
  beforeEach(() => {
    jest.setTimeout(20000);
  });

  it('check build args with array (new configuration arg)', async (t) => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      'configuration-matching': 'confRegex',
      args: ['--build-file', 'build.gradle'],
    });
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      `-Pconfiguration=${quot}confRegex${quot}`,
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
      '--build-file',
      'build.gradle',
    ]);
  });

  it('check build args with array (new configuration arg) with --deamon', async (t) => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      daemon: true,
      'configuration-matching': 'confRegex',
      args: ['--build-file', 'build.gradle'],
    });
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      `-Pconfiguration=${quot}confRegex${quot}`,
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
      '--build-file',
      'build.gradle',
    ]);
  });

  it('check build args with array (legacy configuration arg)', async (t) => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      args: ['--build-file', 'build.gradle', '--configuration=compile'],
    });
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
      '--build-file',
      'build.gradle',
      `-Pconfiguration=${quot}^compile$${quot}`,
    ]);
  });

  it('check build args with scan all subprojects', async (t) => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      allSubProjects: true,
      args: ['--build-file', 'build.gradle', '--configuration', 'compile'],
    });
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-I /tmp/init.gradle',
      '--build-file',
      'build.gradle',
      `-Pconfiguration=${quot}^compile$${quot}`,
      '', // this is a harmless artifact of argument transformation
    ]);
  });

  it('extractJsonFromScriptOutput', async (t) => {
    const result = testableMethods.extractJsonFromScriptOutput(`Mr Gradle says hello
  la dee da, la dee da
  JSONDEPS {"hello": "world"}
  some other noise`);
    expect(result).toEqual({ hello: 'world' });
  });

  it('extractJsonFromScriptOutput throws on no JSONDEPS', async (t) => {
    const output = 'something else entirely';
    return expect(
      testableMethods.extractJsonFromScriptOutput(output),
    ).rejects.toMatch('No line prefixed with "JSONDEPS " was returned');
    // try {
    //   testableMethods.extractJsonFromScriptOutput(output);
    //   expect.assertions(1);
    //   t.fail('Error expected');
    // } catch (e) {
    //   expect(e.message).toBe('No line prefixed with "JSONDEPS " was returned');
    //   expect(e.message).toContain(output);
  });

  it('extractJsonFromScriptOutput throws on multiple JSONDEPS', async (t) => {
    const output = 'JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]';
    expect(testableMethods.extractJsonFromScriptOutput(output)).toThrow();

    // try {
    //   testableMethods.extractJsonFromScriptOutput(output);
    //   t.fail('Error expected');
    // } catch (e) {
    //   t.match(
    //     e.message,
    //     'More than one line with "JSONDEPS " prefix was returned',
    //     'expected error message',
    //   );
    //   t.match(e.message, output, 'error message contains output');
    // }
  });

  it('check build args (plain console output)', async (t) => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {});
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
    ]);
  });
});
