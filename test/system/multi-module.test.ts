import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import * as plugin from '../../lib';

test('multi-project, explicitly targeting a subproject build file', (t) => {
  t.plan(2);
  return plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'subproj', 'build.gradle'))
    .then((result) => {
      t.equals(result.package.name, '.',
        'root project is "."');

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

test('multi-project, ran from root, targeting subproj', (t) => {
  t.plan(2);
  return plugin.inspect(
    fixtureDir('multi-project'),
    'subproj/build.gradle')
    .then((result) => {
      t.equals(result.package.name, 'multi-project',
        'root project is "multi-project"');

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

test('multi-project, ran from a subproject directory', (t) => {
  t.plan(2);
  return plugin.inspect(
    path.join(fixtureDir('multi-project'), 'subproj'),
    'build.gradle')
    .then((result) => {
      t.equals(result.package.name, 'subproj',
        'root project is "subproj"');

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

test('multi-project: only sub-project has deps and they are returned', (t) => {
  t.plan(2);
  const options = {
    'gradle-sub-project': 'subproj',
  };
  return plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    options)
    .then((result) => {
      t.match(result.package.name, '/subproj',
        'sub project name is included in the root pkg name');

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

test('multi-project: only sub-project has deps, none returned for main', (t) => {
  t.plan(2);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package.dependencies);
  })
    .catch(t.threw);
});

test('multi-project: parallel is handled correctly', (t) => {
  t.plan(2);
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const resultPromise = plugin.inspect(fixtureDir('multi-project-parallel'), 'build.gradle');
  resultPromise.then((result) => {
    t.match(result.package.name, 'multi-project-parallel', 'expected project name');
    t.ok(result.package.dependencies);
  })
    .catch(t.threw);
});

test('multi-project: using gradle 3.0.0 via wrapper', (t) => {
  t.plan(2);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-project-gradle-3'), 'build.gradle'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package.dependencies);
  })
    .catch(t.threw);
});
