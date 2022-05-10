import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('malformed build.gradle', async () => {
  try {
    await inspect(
      '.',
      path.join(fixtureDir('malformed-build-gradle'), 'build.gradle'),
      { args: ['--configuration', 'compileClasspath'] },
    );
  } catch (Error) {
    expect(Error.message).toMatch('unexpected token');
  }
});

test('incorrect argument passed to inspect', async () => {
  try {
    await inspect('.', path.join(rootNoWrapper, 'build.gradle'), {
      args: ['--dearGradlePleaseCrash'],
    });
  } catch (error) {
    expect(error.message).toMatch(
      'Please ensure you are calling the `snyk` command with correct arguments',
    );
    expect(error.message).toMatch(/Gradle \d+\.\d+(\.\d+)?/);
  }
});

test('multi-project: error on missing sub-project', async () => {
  const options = {
    subProject: 'non-existent',
  };
  try {
    await inspect(
      '.',
      path.join(fixtureDir('multi-project'), 'build.gradle'),
      options,
    );
  } catch (Error) {
    expect(Error.message).toMatch(
      /Specified sub-project not found: "non-existent". Found these projects: defaultProject, projects/,
    );
  }
});
