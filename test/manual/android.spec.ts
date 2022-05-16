import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// This test requires: env var ANDROID_SDK_ROOT (ANDROID_HOME was deprecated) and Android SDK installed on local machine
// TODO: delete the test or emulate android sdk in CI/CD in order to run it properly
describe.skip('android multi-variant build', () => {
  test('process.env.ANDROID_SDK_ROOT is set', () => {
    expect(
      process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME,
    ).toBeTruthy();
  });

  test('we cannot inspect naively', async () => {
    await expect(
      inspect(
        '.',
        path.join(fixtureDir('android-cannot-auto-resolve'), 'build.gradle'),
        { allSubProjects: true },
      ),
    ).rejects.toThrowError(/Cannot choose between the following variants/);
  }, 90000);

  test('we can inspect with configuration attribute selector', async () => {
    const data = await inspect(
      '.',
      path.join(fixtureDir('android-cannot-auto-resolve'), 'build.gradle'),
      {
        allSubProjects: true,
        'configuration-attributes':
          'buildtype:release,usage:java-runtime,myflavor:local',
      },
    );
    expect(data.scannedProjects.length).toEqual(3);
  }, 90000);
});
