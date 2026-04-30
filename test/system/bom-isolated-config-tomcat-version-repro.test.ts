import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Reproduces the false-positive tomcat-embed-core@10.1.26 seen in CLI v1.1302.0
// (plugin v5.1.1) vs v1.1297.03 (plugin v4.9.2).
//
// Root cause (PR #299): node IDs changed from `group:module@version` to
// `group:module:type[:classifier]@version`.  Snyk merges first-level deps from
// ALL resolved configurations into one list and calls getGradleGraph() with a
// single shared currentChain.  When the same local project (:sub) appears in
// two configurations with different artifact types:
//
//   compileClasspath     → :sub (type=java-classes-directory)  children=empty
//   testCompileClasspath → :sub (type=jar, classifier=test-fixtures)
//                          children include spring-boot-starter-tomcat:3.2.8
//                                           → tomcat-embed-core:10.1.26
//
// In v5.1.1 the two keys differ, so the testFixtures traversal is NOT
// deduplicated.  The root has no explicit 10.1.40 constraint, so Gradle
// resolves tomcat-embed-core to 10.1.26 in testCompileClasspath, and that
// leaks into the merged graph as a false positive.
//
// The fix (chainKey = group:module@version, stripping type + classifier) makes
// both appearances share the same dedup key → testFixtures traversal skipped
// → 10.1.26 never enters the graph.
//
// Fixture layout:
//   root/build.gradle  – compileOnly project(':sub')
//                      – testImplementation testFixtures(project(':sub'))
//                      – NO explicit tomcat constraint
//   sub/build.gradle   – implementation: spring-boot-dependencies:3.2.8 BOM
//                        + spring-boot-starter-web + tomcat-embed-core:10.1.40
//                        (10.1.40 is `implementation`, not `api`, so it is NOT
//                        propagated to consumers — intentional)
//                      – testFixturesImplementation: BOM 3.2.8 only, no upgrade
//                        → tomcat-embed-core:10.1.26 via BOM default

const reproRoot = fixtureDir('bom-isolated-config-tomcat-version-repro');

describe('BOM-isolated config tomcat version repro', () => {
  it('does not surface tomcat-embed-core@10.1.26 as a false positive from testFixtures traversal', async () => {
    const result = await inspect('.', path.join(reproRoot, 'build.gradle'));
    const depPkgs = result.dependencyGraph?.getDepPkgs() ?? [];

    // tomcat-embed-core@10.1.26 must NOT appear.
    //
    // Without the fix, the testFixtures variant of :sub is traversed a second
    // time (different artifact-type key bypasses currentChain), and
    // tomcat-embed-core:10.1.26 leaks into the graph via spring-boot-starter-
    // tomcat:3.2.8 (BOM-managed, no 10.1.40 override in this scope).
    //
    // With the fix, the chainKey strips type/classifier so both :sub variants
    // share the same dedup key — the testFixtures traversal is skipped and
    // 10.1.26 never enters the graph.
    expect(
      depPkgs.some(
        (p) =>
          p.name === 'org.apache.tomcat.embed:tomcat-embed-core' &&
          p.version === '10.1.26',
      ),
    ).toBe(false);
  }, 120_000);
});
