// import { test } from 'tap';
import { exportsForTests as testableMethods } from '../../lib';
import * as os from 'os';
import { error } from 'util';

const isWin = /^win/.test(os.platform());
const quot = isWin ? '"' : "'";

describe('test gradle plugin', () => {
  it('check build args with array (new configuration arg)', async () => {
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

  it('check build args with array (new configuration arg) with --deamon', async () => {
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

  it('check build args with array (legacy configuration arg)', async () => {
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

  it('check build args with scan all subprojects', async () => {
    const mockResult = [
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
    try {
      await testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
        allSubProjects: true,
        args: ['--build-file', 'build.gradle', '--configuration', 'compile'],
      });
    } catch(e) {
      expect(e.message).toEqual(mockResult);
    }
  });

  it('extractJsonFromScriptOutput returns JSONDEPS only', async () => {
    const result = testableMethods.extractJsonFromScriptOutput(`Mr Gradle says hello
la dee da, la dee da
JSONDEPS {"hello": "world"}
some other noise`);
    expect(result).toEqual({ hello: 'world' });
  });

  it('extractJsonFromScriptOutput throws on no JSONDEPS', async () => {
    const output = 'something else entirely';
    try {
    await testableMethods.extractJsonFromScriptOutput(output);
  } catch (e) {
    expect(e.message).toContain(
      `No line prefixed with "JSONDEPS " was returned; full output:\n${output}`,
    );
  }
  });

  it('extractJsonFromScriptOutput throws on multiple JSONDEPS', async () => {
    const output = 'JSONDEPS {"hello": "world"}\nJSONDEPS ["one more thing"]';
    try {
      await testableMethods.extractJsonFromScriptOutput(output)
    } catch(e) {
      expect(e.message).toContain('More than one line with "JSONDEPS " prefix was returned');
    };
  });

  it('check build args (plain console output)', async () => {
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
