import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Regression: documentation-category configurations (OSM-3992).
//
// Project shape (test/fixtures/documentation-configs):
//   implementation 'commons-codec:commons-codec:1.17.1'
//   testDependencySources 'com.fasterxml.jackson.core:jackson-core:2.22.3'
// where testDependencySources is a resolvable configuration requesting
// Category=documentation, DocsType=sources, like the configurations the
// Kotlin Gradle Plugin 2.0.0 creates. jackson-core 2.22.x publishes no
// sources variant, so it fails variant selection there.
//
// Documentation configurations never contribute to a classpath. The walker
// used to emit the failure as an unresolved leaf at the requested version,
// reporting a package the build doesn't use.

const fixtureRoot = fixtureDir('documentation-configs');

describe('documentation-category configurations', () => {
  it('leaves their failed dependencies out of the graph', async () => {
    const result = await inspect('.', path.join(fixtureRoot, 'build.gradle'));

    const depGraph = result.dependencyGraph;
    expect(depGraph).toBeDefined();

    const names = depGraph!.getDepPkgs().map((p) => p.name);
    expect(names).toContain('commons-codec:commons-codec');
    expect(names).not.toContain('com.fasterxml.jackson.core:jackson-core');
  }, 180_000);
});
