import * as path from 'path';
import {fixtureDir, stubSubProcessExec} from '../common';
import {test} from 'tap';

import {inspect} from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('malformed build.gradle', (t) => {
  t.plan(1);
  t.rejects(inspect('.',
    path.join(fixtureDir('malformed-build-gradle'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']}),
    /unexpected token/);
});

test('failing inspect()', (t) => {
  t.plan(1);
  stubSubProcessExec(t);
  t.rejects(inspect('.', path.join(rootNoWrapper, 'build.gradle')));
});

test('multi-project: error on missing subproject', (t) => {
  const options = {
    'gradle-sub-project': 'wrongsubproj',
  };
  t.plan(1);
  t.rejects(
    inspect('.',
      path.join(fixtureDir('multi-project'), 'build.gradle'),
      options),
    'Specified sub-project not found: "wrongsubproj"',
    'error message is as expected',
    );
});
