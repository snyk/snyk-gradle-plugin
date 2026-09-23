import { getPathToFixture } from '../common';
import { inspect } from '../../lib';

// Regression guard for OSM-3867 / OSM-3844.
//
// snyk-gradle-plugin 7.0.0 rewrote init.gradle (#337) to iterate a configuration's attribute
// keySet() while calling getAttribute() inside the loop (buildSnykDepsResult). On Gradle
// 7.4-8.2, keySet() is a live `Sets.union(state.keySet(), lazyAttributes.keySet())` view;
// realizing a lazy (provider-based) attribute via getAttribute() removes it from the backing
// LinkedHashMap, mutating that view mid-iteration and throwing
// java.util.ConcurrentModificationException — which failed every affected Gradle scan. The
// fix restores the pre-7.0.0 snapshot (keySet().toList().each).
//
// This fixture pins Gradle 7.4.2 and attaches two unrealized lazy attributes to a
// non-resolvable configuration — the minimal shape that reproduces the crash (see its
// build.gradle for the full mechanism). Before the fix, inspect() rejects with the CME; after
// the fix it resolves the dependency graph. Gradle fixed the underlying container in 8.3, so
// this only reproduces on 7.4-8.2.
describe('lazy provider attributes (OSM-3867 ConcurrentModificationException guard)', () => {
  test('inspect() resolves a Gradle 7.4.2 project with unrealized lazy attributes', async () => {
    const fixturePath = getPathToFixture('lazy-attribute-provider');
    const expectedDepGraphJson = require(`${fixturePath}/dep-graph.json`);

    const result = await inspect(fixturePath, 'build.gradle');

    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
  }, 120000);
});
