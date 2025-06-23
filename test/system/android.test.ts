import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const gradleVersionFromProcess = process.env.GRADLE_VERSION || '';
const gradleVersionInUse: number = parseInt(
  gradleVersionFromProcess.split('.')[0],
);
const isAndroidSupported: boolean = gradleVersionInUse > 7 ? true : false;
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
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test('minimum gradle version for modern android project is 8', () => {});
}
