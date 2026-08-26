import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Edge case: composite builds (`includeBuild`).
//
// Project shape (test/fixtures/composite-build-includebuild):
//   build.gradle           applies java, declares a single dependency on
//                          'com.example.included:included-lib:0.0.0'
//   settings.gradle        rootProject.name = 'composite-build-root',
//                          includeBuild('included-lib')
//   included-lib/          a separate Gradle build (own settings.gradle,
//                          build.gradle) producing
//                          group=com.example.included, version=0.0.0,
//                          with `api 'org.apache.commons:commons-lang3:3.14.0'`
//
// The external coordinate is automatically substituted by Gradle for the
// included build's project. The runtimeClasspath therefore contains the
// included library's outputs plus its api transitives — nothing from
// Maven Central named `included-lib`.
//
// This test exercises the V6 ResolutionResult walker against composite
// builds: it must follow the substitution into the included build's
// component and surface the included library's transitive
// (commons-lang3) under it. The included project itself appears as a
// graph node (it IS a real component on the classpath, just sourced from
// a sibling build rather than a Maven repo); what matters is that V6
// doesn't drop the boundary or lose the transitive on the way through.

const fixtureRoot = fixtureDir('composite-build-includebuild');

describe('composite build (includeBuild) — modern ResolutionResult walker', () => {
  it('walks the included build and surfaces its transitives', async () => {
    const result = await inspect('.', path.join(fixtureRoot, 'build.gradle'));

    const depGraph = result.dependencyGraph;
    expect(depGraph).toBeDefined();

    const pkgs = depGraph!.getDepPkgs();
    const names = pkgs.map((p) => p.name);

    // commons-lang3 is the included build's `api` transitive — must bubble
    // up into the consuming build's classpath through the substituted
    // project.
    expect(names).toContain('org.apache.commons:commons-lang3');

    // Sanity check the included module surfaces under the coordinate the
    // root build asked for. (This node is the substituted included project
    // standing in for the external coordinate.)
    expect(names).toContain('com.example.included:included-lib');

    // No crashes, no malformed names: every package must have group:name
    // shape and a version.
    for (const p of pkgs) {
      expect(p.name).toMatch(/^[^:]+:[^:]+$/);
      expect(typeof p.version).toBe('string');
      expect(p.version!.length).toBeGreaterThan(0);
    }
  }, 180_000);
});
