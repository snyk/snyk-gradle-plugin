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

  it.each([7, 8, 9, 10])(
    'make sure configuration cache is switched off for Gradle %s and higher',
    async (version) => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init.gradle',
        {},
        `Gradle ${version}`,
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
    },
  );

  describe('isolatedProjectsErrorPattern', () => {
    // Real Gradle output, verified directly rather than guessed: the wording changed
    // between releases within the 8.8+ range where Isolated Projects exists at all.
    it.each([
      [
        'Gradle 8.13 / 8.14.3 / 9.0.0',
        'The configuration cache cannot be disabled when isolated projects is enabled.',
      ],
      [
        'Gradle 9.5.1 / 9.7.1',
        'Configuration Cache cannot be disabled when Isolated Projects is enabled',
      ],
    ])('matches the %s wording', (_label, message) => {
      expect(testableMethods.isolatedProjectsErrorPattern.test(message)).toBe(
        true,
      );
    });

    it('does not match an unrelated configuration cache error', () => {
      expect(
        testableMethods.isolatedProjectsErrorPattern.test(
          'Configuration cache problems found in this build.',
        ),
      ).toBe(false);
    });
  });
});
