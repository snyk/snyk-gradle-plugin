import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const reproRoot = fixtureDir('gradle9-spring-boot4-mockito-objenesis-repro');

const gradleMajor = parseInt(
  (process.env.GRADLE_VERSION || '').split('.')[0] || '0',
  10,
);
// CI sets GRADLE_VERSION per matrix cell; older cells must not run this Gradle 9 + Boot 4 fixture.
// When unset (local dev), run against the fixture wrapper.
const runMockitoObjenesisRepro = gradleMajor >= 9 || gradleMajor === 0;

describe('Gradle 9 / Spring Boot 4 — mockito-core / objenesis merged-config repro', () => {
  (runMockitoObjenesisRepro ? it : it.skip)(
    'includes org.objenesis:objenesis under merged resolvable configurations',
    async () => {
      const result = await inspect(
        '.',
        path.join(reproRoot, 'build.gradle.kts'),
      );
      const depPkgs = result.dependencyGraph.getDepPkgs();
      const objenesis = depPkgs.filter((p) => p.name === 'org.objenesis:objenesis');
      expect(objenesis.length).toBeGreaterThan(0);
      expect(objenesis.some((p) => p.version === '3.3')).toBe(true);
      expect(
        depPkgs.some(
          (p) => p.name === 'org.mockito:mockito-core' && p.version === '5.23.0',
        ),
      ).toBe(true);
      expect(result.dependencyGraph.rootPkg.name).toBe(
        'gradle9-spring-boot4-mockito-objenesis-repro',
      );
    },
    150_000,
  );
});
