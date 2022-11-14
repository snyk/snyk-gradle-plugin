import { exportsForTests as testableMethods } from '../../lib';

const JEST_TIMEOUT = 15000;

describe('Gradle Plugin', () => {
  it('check build args (plain console output)', () => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {});
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I',
      '/tmp/init.gradle',
    ]);
  });

  it('check build args with array (new configuration arg)', async () => {
    const result = testableMethods.buildArgs('.', null, '/tmp/init.gradle', {
      'configuration-matching': 'confRegex',
      args: ['--build-file', 'build.gradle'],
    });
    expect(result).toEqual([
      'snykResolvedDepsJson',
      '-q',
      `-Pconfiguration=confRegex`,
      '--no-daemon',
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I',
      '/tmp/init.gradle',
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
      `-Pconfiguration=confRegex`,
      '-Dorg.gradle.parallel=',
      '-Dorg.gradle.console=plain',
      '-PonlySubProject=.',
      '-I',
      '/tmp/init.gradle',
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
      '-I',
      '/tmp/init.gradle',
      '--build-file',
      'build.gradle',
      `-Pconfiguration=^compile$`,
    ]);
  });

  it(
    'check build args with scan all subprojects',
    async () => {
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
        '-I',
        '/tmp/init.gradle',
        '--build-file',
        'build.gradle',
        `-Pconfiguration=^compile$`,
      ]);
    },
    JEST_TIMEOUT,
  );
});
