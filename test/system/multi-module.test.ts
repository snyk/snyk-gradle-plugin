import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';
import { inspect } from '../../lib';
import { legacyPlugin as api } from '@snyk/cli-interface';
import * as fs from 'fs';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';

test('multi-project, explicitly targeting a subproject build file', async (t) => {
  const fixturePath = path.join(fixtureDir('multi-project'), 'subproj');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.equals(result.package.name, '.', 'root project is "."');
  t.equals(
    result.meta!.gradleProjectName,
    'subproj',
    'root project is "subproj"',
  );
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['subproj']);
  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project, ran from root, targeting subproj', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'subproj/expectedTree.json'),
      'utf-8',
    ),
  );
  const result = await inspect(fixturePath, 'subproj/build.gradle');
  t.equals(
    result.package.name,
    'multi-project',
    'root project is "multi-project"',
  );
  t.equals(
    result.meta!.gradleProjectName,
    'subproj',
    'new root project is "subproj"',
  );
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['subproj']);

  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project, ran from a subproject directory', async (t) => {
  const fixturePath = path.join(fixtureDir('multi-project'), 'subproj');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect(fixturePath, 'build.gradle');
  t.equals(result.package.name, 'subproj', 'root project is "subproj"');
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['subproj']);

  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project: only sub-project has deps and they are returned', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'subproj/expectedTree.json'),
      'utf-8',
    ),
  );
  const options = {
    subProject: 'subproj',
  };
  const result = await inspect(
    '.',
    path.join(fixturePath, 'build.gradle'),
    options,
  );
  t.match(
    result.package.name,
    '/subproj',
    'sub project name is included in the root pkg name',
  );
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['root-proj', 'subproj']);

  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project: only sub-project has deps, none returned for main', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.match(result.package.name, '.', 'returned project name is not sub-project');
  t.match(
    result.meta!.gradleProjectName,
    'root-proj',
    'returned new project name is not sub-project',
  );
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['root-proj', 'subproj']);
  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

let wrapperIsCompatibleWithJvm = true;
const JDK = process.env.JDK;
if (JDK) {
  const major = parseInt(JDK.split('.')[0]);
  if (major >= 13) {
    // see https://github.com/gradle/gradle/issues/8681
    wrapperIsCompatibleWithJvm = false;
  }
}

if (wrapperIsCompatibleWithJvm) {
  test('multi-project: using gradle via wrapper', async (t) => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project gradle wrapper'), 'build.gradle'),
    );
    t.match(
      result.package.name,
      '.',
      'returned project name is not sub-project',
    );
    t.match(
      result.meta!.gradleProjectName,
      'root-proj',
      'returned project name is not sub-project',
    );
    t.equal(result.meta!.versionBuildInfo!.gradleVersion, '5.4.1');
    t.deepEqual(result.plugin.meta!.allSubProjectNames, [
      'root-proj',
      'subproj',
    ]);
    if (result.package.dependencies) {
      t.ok(Object.keys(result.package.dependencies).length === 0);
    }
  });
}

test('multi-project: parallel is handled correctly', async (t) => {
  const fixturePath = fixtureDir('multi-project-parallel');

  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const result = await inspect(fixturePath, 'build.gradle');
  t.match(
    result.package.name,
    'multi-project-parallel',
    'expected project name',
  );
  t.match(
    result.meta!.gradleProjectName,
    'root-proj',
    'expected new project name',
  );
  t.equal(
    result.package.dependencies,
    {},
    'plugin did not return expected result',
  );
});

test('multi-project: only sub-project has deps and they are returned space needs trimming', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'subproj/expectedTree.json'),
      'utf-8',
    ),
  );
  const options = {
    subProject: 'subproj ',
  };
  const result = await inspect(
    '.',
    path.join(fixturePath, 'build.gradle'),
    options,
  );

  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['root-proj', 'subproj']);

  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project: deps for both projects are returned with allSubProjects flag', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'configuration-expectedTree.json'),
      'utf-8',
    ),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    allSubProjects: true,
  });
  // It's an array, so we have to scan
  t.equal(result.scannedProjects.length, 2);
  t.deepEqual(
    result.scannedProjects[0].depTree,
    expectedResult.scannedProjects[0].depTree,
    'plugin did not return expected result',
  );
  t.deepEqual(
    result.scannedProjects[1].depTree,
    expectedResult.scannedProjects[1].depTree,
    'plugin did not return expected result',
  );
});

test('single-project: array of one is returned with allSubProjects flag', async (t) => {
  const fixturePath = fixtureDir('api-configuration');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );

  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    allSubProjects: true,
  });
  t.equal(result.scannedProjects.length, 1);
  t.equal(result.scannedProjects[0].depTree.name, '.');
  t.equal(
    result.scannedProjects[0].meta!.gradleProjectName,
    'api-configuration',
  );
  t.equal(result.scannedProjects.length, 1, 'expected one sub project');
  t.deepEqual(
    result.scannedProjects[0].depTree,
    expectedResult.scannedProjects[0].depTree,
    'plugin did not return expected result',
  );
});

test('multi-project-some-unscannable: allSubProjects fails', async (t) => {
  await t.rejects(
    inspect(
      '.',
      path.join(fixtureDir('multi-project-some-unscannable'), 'build.gradle'),
      { allSubProjects: true },
    ),
  );
});

test('multi-project-some-unscannable: gradle-sub-project for a good subproject works', async (t) => {
  const fixturePath = fixtureDir('multi-project-some-unscannable');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const options = {
    subProject: 'subproj ',
  };
  const result = await inspect(
    '.',
    path.join(fixturePath, 'build.gradle'),
    options,
  );

  t.deepEqual(result.plugin.meta!.allSubProjectNames, [
    'root-proj',
    'subproj',
    'subproj-fail',
  ]);

  t.match(
    result.package.name,
    '/subproj',
    'sub project name is included in the root pkg name',
  );

  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('allSubProjects incompatible with gradle-sub-project', async (t) => {
  await t.rejects(
    inspect('.', path.join(fixtureDir('multi-project'), 'build.gradle'), {
      allSubProjects: true,
      subProject: true,
    } as api.MultiSubprojectInspectOptions),
  );
});

test('multi-project: parallel with allSubProjects produces multiple results with different names', async (t) => {
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const NUMBER_AVAILABLE_PROJECTS = 6;
  const fixturePath = fixtureDir('multi-project-parallel');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect(fixturePath, 'build.gradle', {
    allSubProjects: true,
  });

  t.equal(result.scannedProjects.length, NUMBER_AVAILABLE_PROJECTS);
  for (let i = 0; i < NUMBER_AVAILABLE_PROJECTS; i++) {
    t.deepEqual(
      result.scannedProjects[i],
      expectedResult.scannedProjects[i],
      'plugin did not return expected result',
    );
  }
});

test('multi-project: allSubProjects + configuration', async (t) => {
  const fixturePath = fixtureDir('multi-project');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'configuration-expectedTree.json'),
      'utf-8',
    ),
  );
  const options = {
    allSubProjects: true,
    args: ['--configuration', 'compileOnly'],
  };

  const result = ((await inspect(
    '.',
    path.join(fixturePath, 'build.gradle'),
    options,
  )) as unknown) as MultiProjectResult;
  t.equal(result.scannedProjects.length, 2, 'expected two sub projects');
  t.deepEqual(
    result.scannedProjects[0],
    expectedResult.scannedProjects[0],
    'plugin did not return expected result',
  );
  t.deepEqual(
    result.scannedProjects[1],
    expectedResult.scannedProjects[1],
    'plugin did not return expected result',
  );
});

test('multi-project-dependency-cycle: scanning the main project works fine', async (t) => {
  const fixturePath = fixtureDir('multi-project-dependency-cycle');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {});

  t.equal(result.package.name, '.', 'root project name is "."');
  t.equal(
    result.meta!.gradleProjectName,
    'root-proj',
    'new root project name is "root-proj"',
  );
  t.deepEqual(result.plugin.meta!.allSubProjectNames, ['root-proj', 'subproj']);
  t.deepEqual(
    result.package.dependencies,
    expectedResult.package.dependencies,
    'plugin did not return expected result',
  );
});

test('multi-project-dependency-cycle: scanning all subprojects works fine', async (t) => {
  const fixturePath = fixtureDir('multi-project-dependency-cycle');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'allSubProjects-expectedTree.json'),
      'utf-8',
    ),
  );

  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    allSubProjects: true,
  });
  t.equal(result.scannedProjects.length, 2, 'expected two sub projects');
  t.deepEqual(
    result.scannedProjects[0].depTree,
    expectedResult.scannedProjects[0].depTree,
    'plugin did not return expected result',
  );
  t.deepEqual(
    result.scannedProjects[1].depTree,
    expectedResult.scannedProjects[1].depTree,
    'plugin did not return expected result',
  );
});
