import * as path from 'path';

import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// Edge case: a project that applies the org.springframework.boot Gradle
// plugin and the io.spring.dependency-management plugin.
//
// Project shape (test/fixtures/spring-boot-plugin):
//   build.gradle applies:
//     - id 'java'
//     - id 'org.springframework.boot' version '3.2.10'
//     - id 'io.spring.dependency-management' version '1.1.6'
//   and declares
//     implementation 'org.springframework.boot:spring-boot-starter-web'
//
// The Spring Boot plugin registers custom Gradle configurations
// (bootArchives, developmentOnly, productionRuntimeClasspath, ...) on top
// of the standard Java configurations. Several of these are NOT
// resolvable (canBeResolved == false). V6's findProjectConfigs is
// expected to filter those out and only walk resolvable configurations,
// otherwise resolution would throw.
//
// This is a smoke test: V6 must produce a non-trivial graph containing
// the well-known Spring Boot transitives, with no malformed entries.

const fixtureRoot = fixtureDir('spring-boot-plugin');

describe('Spring Boot plugin — modern ResolutionResult walker', () => {
  it('produces a sane graph for a Spring Boot starter-web project', async () => {
    const result = await inspect('.', path.join(fixtureRoot, 'build.gradle'));

    const depGraph = result.dependencyGraph;
    expect(depGraph).toBeDefined();

    const pkgs = depGraph!.getDepPkgs();

    // Spring Boot starter-web brings in dozens of artifacts; sanity-check
    // a handful of well-known ones.
    const names = pkgs.map((p) => p.name);
    expect(names).toContain('org.springframework.boot:spring-boot-starter-web');
    expect(names).toContain('org.springframework:spring-core');
    expect(names).toContain('org.apache.tomcat.embed:tomcat-embed-core');
    expect(names).toContain('com.fasterxml.jackson.core:jackson-databind');

    // Graph should not be tiny — starter-web pulls many transitives.
    expect(pkgs.length).toBeGreaterThan(20);

    // Every package must have a well-formed name and a non-empty version.
    // This is the malformedness check called out in the test plan: if V6
    // accidentally walks a non-resolvable boot configuration like
    // bootArchives, we'd see synthesised entries with junk versions.
    for (const p of pkgs) {
      expect(p.name).toMatch(/^[^:]+:[^:]+$/);
      expect(typeof p.version).toBe('string');
      expect(p.version!.length).toBeGreaterThan(0);
    }

    // Spring-managed versions must agree across modules: e.g. spring-core
    // and spring-web must be at the same version (the BOM pins them
    // together).
    const springCore = pkgs.find(
      (p) => p.name === 'org.springframework:spring-core',
    );
    const springWeb = pkgs.find(
      (p) => p.name === 'org.springframework:spring-web',
    );
    expect(springCore).toBeDefined();
    expect(springWeb).toBeDefined();
    expect(springCore!.version).toBe(springWeb!.version);
  }, 240_000);
});
