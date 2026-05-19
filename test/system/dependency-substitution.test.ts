import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Edge case: dependency substitution rules
// (`resolutionStrategy.dependencySubstitution`).
//
// Project shape (test/fixtures/dependency-substitution):
//   build.gradle declares `implementation
//   'commons-collections:commons-collections:3.2.2'` and a
//   `configurations.all { resolutionStrategy.dependencySubstitution {
//     substitute(module('commons-collections:commons-collections'))
//       .using(module('org.apache.commons:commons-collections4:4.4'))
//   } }` block that rewrites the coordinate at resolution time.
//
// Substitution rules are applied by Gradle BEFORE the ResolutionResult
// graph is built — by the time V6 sees a ResolvedComponentResult, every
// edge already points at the substitute. The asserted behaviour is
// therefore: the substituted coordinate appears, and the original
// (substituted-away) coordinate does NOT appear.

// `.using(module(...))` on the Substitution receiver was added in Gradle 6.6;
// earlier Gradle (incl. 6.2.1 in the CI matrix) only has the deprecated
// `.with(...)` form. Skip below Gradle 7 rather than branching the fixture
// on version.
const gradleVersionFromProcess = process.env.GRADLE_VERSION || '';
const gradleVersionInUse: number =
  parseInt(gradleVersionFromProcess.split('.')[0]) || 0;
const isSupported = gradleVersionInUse > 6;

const fixtureRoot = fixtureDir('dependency-substitution');

if (isSupported) {
  describe('dependency substitution — modern ResolutionResult walker', () => {
    it('reports the substitute, not the original coordinate', async () => {
      const result = await inspect('.', path.join(fixtureRoot, 'build.gradle'));

      const depGraph = result.dependencyGraph;
      expect(depGraph).toBeDefined();

      const pkgs = depGraph!.getDepPkgs();
      const names = pkgs.map((p) => p.name);

      // Substitute target must appear at the version configured in the
      // substitution rule.
      const collections4 = pkgs.find(
        (p) => p.name === 'org.apache.commons:commons-collections4',
      );
      expect(collections4).toBeDefined();
      expect(collections4!.version).toBe('4.4');

      // Original coordinate must NOT appear: substitution happens before
      // the graph is built, so V6 should never see the pre-substitution
      // module.
      expect(names).not.toContain('commons-collections:commons-collections');
    }, 180_000);
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test('dependency substitution .using() requires Gradle >= 6.6', () => {});
}
