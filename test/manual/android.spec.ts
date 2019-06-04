import * as path from 'path';
import {fixtureDir} from '../common';
import {inspect} from '../../lib';

describe('android multi-variant build', () => {

  expect(process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME).toBeTruthy();

  test('we cannot inspect naively', async () => {
    await expect(
      inspect(
        '.',
        path.join(fixtureDir('android-cannot-auto-resolve'), 'build.gradle'),
        {multiDepRoots: true}
      ),
    ).rejects.toThrowError(/Cannot choose between the following variants/);
  }, 90000);

  test('we can inspect with configuration attribute selector', async () => {
      let data = await inspect(
        '.',
        path.join(fixtureDir('android-cannot-auto-resolve'), 'build.gradle'),
        {multiDepRoots: true, 'configuration-attributes': 'buildtype:release,usage:java-runtime,myflavor:local'}
      );
      expect(data.depRoots.length).toEqual(3);
  }, 90000);
});
