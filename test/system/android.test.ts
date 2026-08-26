import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const gradleVersionFromProcess = process.env.GRADLE_VERSION || '';
const gradleVersionInUse: number = parseInt(
  gradleVersionFromProcess.split('.')[0],
);
const isAndroidSupported: boolean = gradleVersionInUse > 7 ? true : false;

// V6 (lib/init.gradle, ResolutionResult + ArtifactView) was validated against
// this fixture on Gradle 8.14.1: the configuration-attributes filter still
// narrows the set of resolvable configurations via findMatchingConfigs, and
// the per-component variant within each configuration is then selected by
// configuration.incoming.artifactView { lenient = true } — which inherits the
// configuration's own attributes when no explicit attributes block is given.
// This is the modern equivalent of the legacy ResolvedConfiguration walk and
// keeps Android variant resolution working without passing confAttrSpec into
// the ArtifactView. Empirical check: with
// `buildtype:release,usage:java-runtime` the app graph contains
// androidx.appcompat:appcompat but excludes androidx.test.espresso:espresso-
// core / androidx.test:runner; without the filter, both sets appear.
if (isAndroidSupported) {
  describe('android version 8 build', () => {
    test('we can inspect naively', async () => {
      const data = await inspect(
        '.',
        path.join(fixtureDir('modern-android'), 'build.gradle'),
        { allSubProjects: true },
      );
      expect(data.scannedProjects.length).toEqual(2);
    }, 90000);

    test('we can inspect with configuration attribute selector', async () => {
      const data = await inspect(
        '.',
        path.join(fixtureDir('modern-android'), 'build.gradle'),
        {
          allSubProjects: true,
          'configuration-attributes':
            'buildtype:release,usage:java-runtime,myflavor:local',
        },
      );
      expect(data.scannedProjects.length).toEqual(2);
    }, 90000);

    // Stronger V6 regression: verify the configuration-attributes filter
    // actually trims the resolved graph (Android-test-only deps must NOT
    // appear when buildtype:release + usage:java-runtime is selected).
    test('configuration attribute selector excludes androidTest variants', async () => {
      const data = await inspect(
        '.',
        path.join(fixtureDir('modern-android'), 'build.gradle'),
        {
          allSubProjects: true,
          'configuration-attributes': 'buildtype:release,usage:java-runtime',
        },
      );
      const appProject = data.scannedProjects.find((p) =>
        p.targetFile?.endsWith(path.join('app', 'build.gradle')),
      );
      expect(appProject).toBeDefined();
      const names = (appProject as any).depGraph
        .getDepPkgs()
        .map((q: { name: string }) => q.name);
      // runtime deps of the release variant should be present
      expect(names).toContain('androidx.appcompat:appcompat');
      expect(names).toContain('com.google.android.material:material');
      // androidTest-only deps should NOT be present in release-runtime
      expect(names).not.toContain('androidx.test.espresso:espresso-core');
      expect(names).not.toContain('androidx.test:runner');
    }, 120000);
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test('minimum gradle version for modern android project is 8', () => {});
}
