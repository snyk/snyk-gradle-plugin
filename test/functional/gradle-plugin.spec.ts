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

  it('strips a requested configuration cache below the supported version', () => {
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
    expect(result).not.toContain('--configuration-cache');
  });

  it.each(['Gradle 7.0', 'Gradle 7.6.4', 'Gradle 8.0.2'])(
    'switches the configuration cache off for %s, which uses init.gradle',
    (version) => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init.gradle',
        {},
        version,
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

  // On 8.1+ the injected script is cache-compatible, so the build's own setting is
  // left alone: not forced on, not forced off. Forcing it off breaks any build
  // using Isolated Projects, which cannot run without a configuration cache.
  it.each(['Gradle 8.1', 'Gradle 8.4', 'Gradle 9.0.0', 'Gradle 10.0'])(
    'leaves the configuration cache alone for %s',
    (version) => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init-cc.gradle',
        {},
        version,
      );
      expect(result).not.toContain('--no-configuration-cache');
      expect(result).not.toContain('--configuration-cache');
    },
  );

  // init-cc.gradle emits from a single build service, so concurrent per-project
  // reporting cannot produce more than one JSONDEPS line. The old serialization
  // workaround is only needed for init.gradle.
  it.each(['Gradle 8.1', 'Gradle 9.0.0'])(
    'does not force serial execution for %s',
    (version) => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init-cc.gradle',
        {},
        version,
      );
      expect(result).not.toContain('-Dorg.gradle.parallel=');
    },
  );

  it.each(['Gradle 4.10', 'Gradle 7.3', 'Gradle 8.0.2'])(
    'still forces serial execution for %s, which uses init.gradle',
    (version) => {
      const result = testableMethods.buildArgs(
        '.',
        null,
        '/tmp/init.gradle',
        {},
        version,
      );
      expect(result).toContain('-Dorg.gradle.parallel=');
    },
  );

  it('keeps a caller-requested configuration cache on a supported version', () => {
    const result = testableMethods.buildArgs(
      '.',
      null,
      '/tmp/init-cc.gradle',
      {
        args: ['--configuration-cache'],
      },
      'Gradle 9.0.0',
    );
    expect(result).toContain('--configuration-cache');
    expect(result).not.toContain('--no-configuration-cache');
  });

  describe('init script selection', () => {
    it.each([
      ['Gradle 4.10', 'init.gradle'],
      ['Gradle 6.2.1', 'init.gradle'],
      ['Gradle 7.3', 'init.gradle'],
      ['Gradle 8.0.2', 'init.gradle'],
      ['Gradle 8.1', 'init-cc.gradle'],
      ['Gradle 8.4', 'init-cc.gradle'],
      ['Gradle 9.2.0', 'init-cc.gradle'],
      ['Gradle 10.0', 'init-cc.gradle'],
    ])('picks %s -> %s', (version, expected) => {
      expect(testableMethods.initScriptFor(version)).toBe(expected);
    });

    it('falls back to init.gradle when the version cannot be read', () => {
      expect(testableMethods.initScriptFor('[COULD NOT RUN gradle -v]')).toBe(
        'init.gradle',
      );
      expect(
        testableMethods.supportsConfigurationCache('[COULD NOT RUN gradle -v]'),
      ).toBe(false);
    });
  });
});
