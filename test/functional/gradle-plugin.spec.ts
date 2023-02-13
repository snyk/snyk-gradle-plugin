import { exportsForTests as testableMethods } from '../../lib';

const JEST_TIMEOUT = 15000;
const gradleVersion = 'Gradle 6';

describe('Gradle Plugin', () => {
  it('check build args (plain console output)', () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {},
      gradleVersion,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        'snykResolvedDepsJson',
        '-q',
        '-Dorg.gradle.parallel=',
        '-Dorg.gradle.console=plain',
        '-PonlySubProject=.',
        '-I',
        '/tmp/init.gradle',
      ]),
    );
  });

  it('check build args with array (new configuration arg)', async () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {
        'configuration-matching': 'confRegex',
        args: ['--build-file', 'build.gradle'],
      },
      gradleVersion,
    );
    expect(result).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it('check build args with array (new configuration arg) with --deamon', async () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {
        daemon: true,
        'configuration-matching': 'confRegex',
        args: ['--build-file', 'build.gradle'],
      },
      gradleVersion,
    );
    expect(result).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it('check build args with array (legacy configuration arg)', async () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {
        args: ['--build-file', 'build.gradle', '--configuration=compile'],
      },
      gradleVersion,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        'snykResolvedDepsJson',
        '-q',
        '-Dorg.gradle.parallel=',
        '-Dorg.gradle.console=plain',
        '-PonlySubProject=.',
        '-I',
        '/tmp/init.gradle',
        '--build-file',
        'build.gradle',
        `-Pconfiguration=^compile$`,
      ]),
    );
  });

  it(
    'check build args with scan all subprojects',
    async () => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init.gradle',
        {
          allSubProjects: true,
          args: ['--build-file', 'build.gradle', '--configuration', 'compile'],
        },
        gradleVersion,
      );
      expect(result).toEqual(
        expect.arrayContaining([
          'snykResolvedDepsJson',
          '-q',
          '-Dorg.gradle.parallel=',
          '-Dorg.gradle.console=plain',
          '-I',
          '/tmp/init.gradle',
          '--build-file',
          'build.gradle',
          `-Pconfiguration=^compile$`,
        ]),
      );
    },
    JEST_TIMEOUT,
  );

  it('make sure configuration cache is switched off even if requested', () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {
        args: ['--configuration-cache'],
      },
      gradleVersion,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        'snykResolvedDepsJson',
        '-q',
        '-Dorg.gradle.parallel=',
        '-Dorg.gradle.console=plain',
        '-PonlySubProject=.',
        '-I',
        '/tmp/init.gradle',
      ]),
    );
  });

  it('make sure configuration cache is switched off for Gradle 7', () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init.gradle',
      {},
      'Gradle 7',
    );
    expect(result).toEqual(
      expect.arrayContaining([
        'snykResolvedDepsJson',
        '-q',
        '-Dorg.gradle.parallel=',
        '-Dorg.gradle.console=plain',
        '-PonlySubProject=.',
        '-I',
        '/tmp/init.gradle',
        '--no-configuration-cache',
      ]),
    );
  });
});
