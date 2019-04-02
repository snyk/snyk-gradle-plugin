import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import {inspect, MultiRootsInspectOptions} from '../../lib';

test('multi-project, explicitly targeting a subproject build file', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-project'), 'subproj', 'build.gradle'));
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
});

test('multi-project, ran from root, targeting subproj', async (t) => {
  const result = await inspect(
    fixtureDir('multi-project'),
    'subproj/build.gradle');
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
});

test('multi-project, ran from a subproject directory', async (t) => {
  const result = await inspect(
    path.join(fixtureDir('multi-project'), 'subproj'),
    'build.gradle');
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
});

test('multi-project: only sub-project has deps and they are returned', async (t) => {
  const options = {
    'gradle-sub-project': 'subproj',
  };
  const result = await inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    options);
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
});

test('multi-project: only sub-project has deps, none returned for main', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'));
  t.match(result.package.name, '.',
    'returned project name is not sub-project');
  t.notOk(result.package.dependencies);
});

test('multi-project: using gradle 3.0.0 via wrapper', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-project-gradle-3'), 'build.gradle'));
  t.match(result.package.name, '.',
    'returned project name is not sub-project');
  t.notOk(result.package.dependencies);
});

test('multi-project: parallel is handled correctly', async (t) => {
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const result = await inspect(fixtureDir('multi-project-parallel'), 'build.gradle');
  t.match(result.package.name, 'multi-project-parallel', 'expected project name');
  t.ok(result.package.dependencies);
});

test('multi-project: only sub-project has deps and they are returned space needs trimming', async (t) => {
  const options = {
    'gradle-sub-project': 'subproj ',
  };
  const result = await inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    options);
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
});

test('multi-project: deps for both projects are returned with multiDepRoots flag', async (t) => {
  const result = await inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'), {multiDepRoots: true});
  // It's an array, so we have to scan
  t.equal(result.depRoots.length, 2);
  for (const p of result.depRoots) {
    if (p.depTree.name === '.') {
      t.notOk(p.depTree.dependencies, 'no dependencies for the main depRoot');
      t.notOk(p.targetFile, 'no target file returned'); // see targetFileFilteredForCompatibility
      // t.match(p.targetFile, 'multi-project' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    } else {
      t.equal(p.depTree.name, './subproj',
        'sub project name is included in the root pkg name');
      t.equal(p.depTree
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
      t.notOk(p.targetFile, 'no target file returned'); // see targetFileFilteredForCompatibility
      // t.match(p.targetFile, 'subproj' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    }
  }
});

test('multiDepRoots incompatible with gradle-sub-project', (t) => {
  t.plan(1);
  t.rejects(inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    {'multiDepRoots': true, 'gradle-sub-project': true} as MultiRootsInspectOptions));
});

test('multi-project: parallel with multiDepRoots produces multiple results with different names', async (t) => {
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const result = await inspect(fixtureDir('multi-project-parallel'), 'build.gradle', {multiDepRoots: true});
  t.equal(result.depRoots.length, 6);
  const names = new Set<string>();
  for (const p of result.depRoots) {
    names.add(p.depTree.name);
  }
  t.deepEqual(names, new Set<string>([
    'multi-project-parallel', 
    'multi-project-parallel/subproj0', 
    'multi-project-parallel/subproj1', 
    'multi-project-parallel/subproj2', 
    'multi-project-parallel/subproj3', 
    'multi-project-parallel/subproj4']));
});
