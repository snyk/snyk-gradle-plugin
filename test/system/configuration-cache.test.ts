import * as fs from 'fs';
import * as path from 'path';

import { getPathToFixture } from '../common';
import { inspect } from '../../lib';

// The init-gradle fixture pins its own wrapper at Gradle 8.13 and already sets
// org.gradle.configuration-cache=true in gradle.properties. Because the plugin
// resolves `./gradlew` in preference to whatever Gradle is on PATH, these tests run
// at 8.13 whatever version the CI matrix is exercising, which puts them above both
// thresholds that matter: 8.1 for the cache-compatible init script and 8.8 for
// gradle.lifecycle, the Isolated Projects-safe per-project hook.
const fixturePath = getPathToFixture('init-gradle');

// The injected script bootstraps its per-project wiring two different ways, and the
// fixture's pinned Gradle version is what selects between them:
//   8.8+     gradle.lifecycle.beforeProject, the Isolated Projects-safe hook
//   8.1-8.7  gradle.allprojects
// init-gradle is 8.13, so it only ever exercises the first. This 8.4 fixture covers
// the second with the cache switched on, which nothing else does.
const allprojectsTierFixturePath = getPathToFixture('kts-basic-with-deps');

const cacheDirFor = (fixture: string) =>
  path.join(fixture, '.gradle', 'configuration-cache');
const configurationCacheDir = cacheDirFor(fixturePath);

// Any configuration cache or Isolated Projects problem becomes a build failure
// rather than a warning, so a regression surfaces as a failing test instead of a
// scan that quietly degrades to no caching at all.
const failOnCacheProblems = '-Dorg.gradle.configuration-cache.problems=fail';

describe('configuration cache and Isolated Projects', () => {
  beforeEach(() => {
    // Removed so that its presence afterwards is evidence this scan used the cache,
    // rather than something an earlier test left behind.
    fs.rmSync(configurationCacheDir, { recursive: true, force: true });
    fs.rmSync(cacheDirFor(allprojectsTierFixturePath), {
      recursive: true,
      force: true,
    });
  });

  it('scans a build that has the configuration cache enabled', async () => {
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    const result = await inspect(fixturePath, 'app/build.gradle', {
      args: [failOnCacheProblems],
    });

    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    // The graph alone would also match with the cache disabled, so assert the cache
    // was genuinely used. Before this plugin stopped passing
    // --no-configuration-cache, that flag overrode the fixture's gradle.properties
    // and no entry was ever written.
    expect(fs.existsSync(configurationCacheDir)).toBe(true);
  }, 120000);

  it('reuses a stored configuration cache entry on a second scan', async () => {
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    const first = await inspect(fixturePath, 'app/build.gradle', {
      args: [failOnCacheProblems],
    });
    const second = await inspect(fixturePath, 'app/build.gradle', {
      args: [failOnCacheProblems],
    });

    // A cache hit does not re-run the init script, so the second scan exercises a
    // different path through the injected code: the tasks and the collecting build
    // service are restored from the entry rather than configured afresh. Identical
    // graphs are what proves the restored path still reports correctly.
    expect(first.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    expect(second.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
  }, 180000);

  it('scans a build that has Isolated Projects enabled', async () => {
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    const result = await inspect(fixturePath, 'app/build.gradle', {
      args: ['-Dorg.gradle.unsafe.isolated-projects=true', failOnCacheProblems],
    });

    // Compared against the same golden file the cache-only tests use, with nothing
    // normalized. That is the point: this fixture pins Gradle 8.13, which appends a
    // trailing dot to a subproject's default group under Isolated Projects
    // (https://github.com/gradle/gradle/issues/33248, fixed in 9.1.0 and not
    // backported), so without the trim in SnykGraphBuilder.projectGroup the project
    // dependencies would arrive as 'init-gradle.:list' and this would fail.
    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    // Isolated Projects cannot run without a configuration cache, so an entry here
    // also confirms the two are working together rather than one silently winning.
    expect(fs.existsSync(configurationCacheDir)).toBe(true);
  }, 120000);

  it('scans with the cache enabled on the gradle.allprojects tier', async () => {
    const cacheDir = cacheDirFor(allprojectsTierFixturePath);

    // No golden file is needed, and none exists for this fixture. Comparing the two
    // runs against each other asserts the invariant that actually matters, which is
    // that turning the cache on does not change what gets reported. It also fails if
    // either run breaks outright.
    const withoutCache = await inspect(
      allprojectsTierFixturePath,
      'build.gradle.kts',
      { args: ['--no-configuration-cache'] },
    );
    expect(fs.existsSync(cacheDir)).toBe(false);

    const withCache = await inspect(
      allprojectsTierFixturePath,
      'build.gradle.kts',
      {
        args: ['-Dorg.gradle.configuration-cache=true', failOnCacheProblems],
      },
    );

    expect(withCache.dependencyGraph?.toJSON()).toEqual(
      withoutCache.dependencyGraph?.toJSON(),
    );
    expect(fs.existsSync(cacheDir)).toBe(true);
  }, 180000);

  it('still produces a graph when the caller disables the cache', async () => {
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    // The plugin no longer forces the cache off, but it must not depend on it being
    // on either: the injected script has to work whichever way the build is set up,
    // and off is what most builds still do.
    const result = await inspect(fixturePath, 'app/build.gradle', {
      args: ['--no-configuration-cache'],
    });

    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    expect(fs.existsSync(configurationCacheDir)).toBe(false);
  }, 120000);
});
