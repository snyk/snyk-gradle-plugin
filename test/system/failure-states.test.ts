import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('malformed build.gradle', async () => {
  await expect(
    inspect(
      '.',
      path.join(fixtureDir('malformed-build-gradle'), 'build.gradle'),
      { args: ['--configuration', 'compileClasspath'] },
    ),
  ).rejects.toThrowError(/unexpected token/);
});

test('incorrect argument passed to inspect', async () => {
  await expect(
    inspect('.', path.join(rootNoWrapper, 'build.gradle'), {
      args: ['--dearGradlePleaseCrash'],
    }),
  ).rejects.toThrowError(
    'Please ensure you are calling the `snyk` command with correct arguments',
  );
});

test('multi-project: error on missing sub-project', async () => {
  const options = {
    subProject: 'non-existent',
  };
  await expect(
    inspect(
      '.',
      path.join(fixtureDir('multi-project'), 'build.gradle'),
      options,
    ),
  ).rejects.toThrowError(
    /Specified sub-project not found: "non-existent". Found these projects: defaultProject, projects/,
  );
});

test('error when requested configurations are not found in the project', async () => {
  await expect(
    inspect('.', path.join(rootNoWrapper, 'build.gradle'), {
      'configuration-matching': 'nonExistentConfig',
    }),
  ).rejects.toThrowError(/Matching configurations/);
});
