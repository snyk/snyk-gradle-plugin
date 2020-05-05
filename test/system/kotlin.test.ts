import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';

import { inspect } from '../../lib';

let kotlinSupported = true;
const GRADLE_VERSION = process.env.GRADLE_VERSION;
if (GRADLE_VERSION) {
  const major = parseInt(GRADLE_VERSION.split('.')[0]);
  if (major < 5) {
    kotlinSupported = false;
  }
}

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
if (kotlinSupported) {
  test(
    'build.gradle.kts files are supported',
    { timeout: 150000 },
    async (t) => {
      const result = await inspect(
        '.',
        path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'),
      );
      t.match(
        result.package.name,
        '.',
        'returned project name is not sub-project',
      );
      t.match(
        result.meta!.gradleProjectName,
        'gradle-kts',
        'returned new project name is not sub-project',
      );
      t.equal(
        result.package.dependencies!['org.jetbrains.kotlin:kotlin-stdlib-jdk8']
          .dependencies!['org.jetbrains.kotlin:kotlin-stdlib'].dependencies![
          'org.jetbrains.kotlin:kotlin-stdlib-common'
        ].version,
        '1.3.21',
        'correct version of a dependency is found',
      );
      t.equal(
        Object.keys(result.package.dependencies!).length,
        6,
        'top level deps: 6',
      );
    },
  );
}
