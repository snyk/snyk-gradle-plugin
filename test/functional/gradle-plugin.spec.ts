// import { test } from 'tap';
import { exportsForTests as testableMethods } from '../../lib';
import * as os from 'os';
import { error } from 'util';

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : "'";

describe('test gradle plugin', () => {
  it('check build args with array (new configuration arg)', async () => {
    // Setup
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      'configuration-matching': 'confRegex',
      args: ['--build-file', 'build.gradle'],
    });
    const expectedResult = [
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
    ];
    // Verify
    expect(result).toEqual(expectedResult);
  });

  it('check build args with array (new configuration arg) with --daemon', async () => {
    // Setup
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      daemon: true,
      'configuration-matching': 'confRegex',
      args: ['--build-file', 'build.gradle'],
    });
    const expectedResult = [
      'snykResolvedDepsJson',
      '-q',
      `-Pconfiguration=${quot}confRegex${quot}`,
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
      '--build-file',
      'build.gradle',
    ];
    // Verify
    expect(result).toEqual(expectedResult);
  });

  it('check build args with array (legacy configuration arg)', async () => {
    // Setup
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      args: ['--build-file', 'build.gradle', '--configuration=compile'],
    });
    const expectedResult = [
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
    ];
    // Verify
    expect(result).toEqual(expectedResult);
  });

  it('check build args with scan all subprojects', async () => {
    // Setup
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      allSubProjects: true,
      args: ['--build-file', 'build.gradle', '--configuration', 'compile'],
    });
    const expectedResult = [
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
    ];
    // Verify
    expect(result).toEqual(expectedResult);
  });

  it('extractJsonFromScriptOutput returns JSONDEPS only', async () => {
    // Setup
    const result = testableMethods.extractJsonFromScriptOutput(`Mr Gradle says hello
la dee da, la dee da
JSONDEPS {"hello": "world"}
some other noise`);
    const expectedResult = { hello: 'world' };
    // Verify
    expect(result).toEqual(expectedResult);
  });

  it('extractJsonFromScriptOutput throws on no JSONDEPS', async () => {
    // Setup
    const output = 'something else entirely';
    try {
      // Exercise
      testableMethods.extractJsonFromScriptOutput(output);
    } catch (e) {
      // Verify `expected error message and output`
      expect(e.message).toBe(
        `No line prefixed with "JSONDEPS " was returned; full output:\n${output}`,
      );
    }
  });

  it('extractJsonFromScriptOutput throws on multiple JSONDEPS', async () => {
    // Setup
    const output = 'JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]';
    try {
      // Exercise
      testableMethods.extractJsonFromScriptOutput(output);
    } catch (e) {
      // Verify `expected error message`
      expect(e.message).toBe(
        'More than one line with "JSONDEPS " prefix was returned',
      );
    }
  });

  it('check build args (plain console output)', async () => {
    // Setup
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {});
    const expectedResult = [
      'snykResolvedDepsJson',
      '-q',
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I /tmp/init.gradle',
    ];
    // Verify
    expect(result).toEqual(expectedResult);
  });
});
