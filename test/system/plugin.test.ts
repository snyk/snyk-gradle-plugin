import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';

import {inspect} from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('run inspect()', async (t) => {
  const result = await inspect('.', path.join(rootNoWrapper, 'build.gradle'));
  t.equal(result.package
    .dependencies!['com.android.tools.build:builder']
    .dependencies!['com.android.tools:sdklib']
    .dependencies!['com.android.tools:repository']
    .dependencies!['com.android.tools:common']
    .dependencies!['com.android.tools:annotations'].version,
  '25.3.0',
  'correct version found');
});

test('multi-confg: both compile and runtime deps picked up by default', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'));
  t.match(result.package.name, '.',
    'returned project name is not sub-project');
  t.equal(result.package
    .dependencies!['com.android.tools.build:builder']
    .dependencies!['com.android.tools:sdklib']
    .dependencies!['com.android.tools:repository']
    .dependencies!['com.android.tools:common']
    .dependencies!['com.android.tools:annotations'].version,
  '25.3.0',
  'correct version of compile+runtime dep found');
  t.equal(result.package
    .dependencies!['javax.servlet:servlet-api'].version,
  '2.5',
  'correct version of compileOnly dep found');
  t.equal(Object.keys(result.package.dependencies!).length, 6, 'top level deps: 6');
});

test('multi-confg: only deps for specified conf are picked up', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  t.match(result.package.name, '.',
    'returned project name is not sub-project');
  t.notOk(result.package
    .dependencies!['com.android.tools.build:builder'],
  'no compile+runtime dep found');
  t.equal(result.package
    .dependencies!['javax.servlet:servlet-api'].version,
  '2.5',
  'correct version of compileOnly dep found');
  t.equal(Object.keys(result.package.dependencies!).length, 1, 'top level deps: 1');
});
