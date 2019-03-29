import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import * as plugin from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');

test('run inspect()', (t) => {
  t.plan(1);
  return plugin.inspect('.', path.join(rootNoWrapper, 'build.gradle'))
    .then((result) => {
      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-confg: both compile and runtime deps picked up by default', (t) => {
  t.plan(4);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'));
  resultPromise.then((result) => {
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
  })
    .catch(t.threw);
});

test('multi-confg: only deps for specified conf are picked up', (t) => {
  t.plan(4);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  resultPromise.then((result) => {
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
  })
    .catch(t.threw);
});
