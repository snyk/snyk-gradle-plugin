import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';

import {inspect} from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('malformed build.gradle', async (t) => {
  await t.rejects(inspect('.',
    path.join(fixtureDir('malformed-build-gradle'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']}),
    /unexpected token/);
});

test('failing inspect()', async (t) => {
  try {
    await inspect('.', path.join(rootNoWrapper, 'build.gradle'), {args: ['--dearGradlePleaseCrash']});
    t.fail('Expected error');
  } catch (error) {
    t.match(error.message, 'Please ensure you are calling the `snyk` command with correct arguments',
      'proper error message');
    t.match(error.message, /Gradle \d+\.\d+(\.\d+)?/,
      'the error message has Gradle version');
  }
});

test('multi-project: error on missing sub-project', async (t) => {
  const options = {
    subProject: 'non-existent',
  };
  await t.rejects(inspect('.',
      path.join(fixtureDir('multi-project'), 'build.gradle'),
      options),
    /Specified sub-project not found: "non-existent". Found these projects: defaultProject, projects/,
    'error message is as expected',
    );
});
