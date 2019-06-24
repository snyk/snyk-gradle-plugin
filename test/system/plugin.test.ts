import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import {inspect} from '../../lib';
import * as subProcess from '../../lib/sub-process';

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

test('multi-confg: only deps for specified conf are picked up (precise match)', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    {'configuration-matching': '^compileOnly$'});
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


test('multi-confg: only deps for specified conf are picked up (fuzzy match)', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    {'configuration-matching': 'pileon'}); // case-insensitive regexp matching "compileOnly"
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

test('multi-confg: only deps for specified conf are picked up (using legacy CLI argument)', async (t) => {
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

test('tests for Gradle 3+', async (t0) => {
  const gradleVersionOutput = await subProcess.execute('gradle', ['-v'], {});
  const isGradle3Plus = parseInt(gradleVersionOutput.match(/Gradle (\d+)\.\d+(\.\d+)?/)![1]) >= 3;
  if (isGradle3Plus) {

    t0.test('multi-config: only deps for specified conf are picked up (attribute match)', async (t) => {
      const result = await inspect('.',
        path.join(fixtureDir('multi-config-attributes'), 'build.gradle'),
        {'configuration-attributes': 'usage:java-api'});
      t.match(result.package.name, '.',
        'returned project name is not sub-project');
      t.notOk(result.package
        .dependencies!['org.apache.commons:commons-lang3'],
      'no runtime dep found');
      t.equal(result.package
        .dependencies!['commons-httpclient:commons-httpclient'].version,
      '3.1',
      'correct version of api dep found');
      t.equal(Object.keys(result.package.dependencies!).length, 2, 'top level deps: 2'); // 1 with good attr, 1 with no attr
    });

    t0.test('multi-config: only deps for specified conf are picked up (subproject variants)', async (t) => {
      // This test is different from the previous because of specificAttr
      // When constructing a merged configuration, it's important to scan all the subprojects and discover all the
      // values of specificAttr to make sure the configuration
      const result = await inspect('.',
        path.join(fixtureDir('multi-config-attributes-subproject'), 'build.gradle'),
        {'configuration-attributes': 'usage:java-api'}); // there's also specificAttr but it won't be picked up
      t.match(result.package.name, '.',
        'returned project name is not sub-project');
      t.notOk(result.package
        .dependencies!['org.apache.commons:commons-lang3'],
      'no runtime dep found');
      t.equal(result.package
        .dependencies!['commons-httpclient:commons-httpclient'].version,
      '3.1',
      'correct version of api dep found');
      t.equal(Object.keys(result.package.dependencies!).length, 3, 'top level deps: '); // 1 with good attr, 1 with no attr
    });

  }
})
