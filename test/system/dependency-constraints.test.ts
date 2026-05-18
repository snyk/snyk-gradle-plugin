import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Edge case: dependency constraints (`dependencies { constraints { ... } }`).
//
// Project shape (test/fixtures/dependency-constraints):
//   build.gradle declares
//     implementation 'org.apache.httpcomponents:httpclient:4.5.13'
//   (which transitively pulls commons-codec:1.11) and a constraint
//     implementation('commons-codec:commons-codec:1.17.1')
//   that pins commons-codec to a higher version. Constraints are how
//   Gradle BOMs (e.g. Spring Boot's dependency-management plugin) impose
//   versions on the graph; they participate in version conflict
//   resolution rather than overriding it like `force` does.
//
// V6 reads the resolved ResolutionResult after Gradle has applied the
// constraint, so the resolved graph for httpclient should include
// commons-codec at 1.17.1 (not 1.11).

const fixtureRoot = fixtureDir('dependency-constraints');

describe('dependency constraints — modern ResolutionResult walker', () => {
  it('reflects constraint-pinned versions in the resolved graph', async () => {
    const result = await inspect('.', path.join(fixtureRoot, 'build.gradle'));

    const depGraph = result.dependencyGraph;
    expect(depGraph).toBeDefined();

    const pkgs = depGraph!.getDepPkgs();

    const codec = pkgs.find((p) => p.name === 'commons-codec:commons-codec');
    expect(codec).toBeDefined();
    // Constraint pinned 1.17.1 — must win over the transitive 1.11.
    expect(codec!.version).toBe('1.17.1');

    // The pre-constraint version must not appear (single resolved version
    // per module on a single classpath).
    const codecVersions = pkgs
      .filter((p) => p.name === 'commons-codec:commons-codec')
      .map((p) => p.version);
    expect(codecVersions).toEqual(['1.17.1']);

    // The originating dep should still be present.
    expect(pkgs.map((p) => p.name)).toContain(
      'org.apache.httpcomponents:httpclient',
    );
  }, 180_000);
});
