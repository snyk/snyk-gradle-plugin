import * as path from 'path';
import * as fs from 'fs';
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
      const fixturePath = fixtureDir('gradle-kts');
      const expectedResult = JSON.parse(
        fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
      );
      const result = await inspect(
        '.',
        path.join(fixturePath, 'build.gradle.kts'),
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
      t.deepEqual(result, expectedResult, 'plugin returned expected result');
      t.equal(
        Object.keys(result.package.dependencies!).length,
        6,
        'top level deps: 6',
      );
    },
  );
}
