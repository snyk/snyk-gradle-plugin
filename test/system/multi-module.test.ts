import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';
import { legacyPlugin as api } from '@snyk/cli-interface';

const multiProject = fixtureDir('multi-project');

test('multi-project, explicitly targeting a subproject build file', async () => {
  const result = await inspect(
    '.',
    path.join(multiProject, 'subproj', 'build.gradle'),
  );
  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('subproj');
  expect(result.plugin.meta!.allSubProjectNames).toEqual([]);

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(0);
});

test('multi-project, ran from root, targeting subproj', async () => {
  const result = await inspect(multiProject, 'subproj/build.gradle');
  expect(result.dependencyGraph.rootPkg.name).toBe('multi-project');
  expect(result.meta!.gradleProjectName).toBe('subproj');
  expect(result.plugin.meta!.allSubProjectNames).toEqual([]);

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(-1);
});

test('multi-project, ran from a subproject directory', async () => {
  const result = await inspect(
    path.join(multiProject, 'subproj'),
    'build.gradle',
  );
  expect(result.dependencyGraph.rootPkg.name).toBe('subproj');
  expect(result.plugin.meta!.allSubProjectNames).toEqual([]);

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(-1);
});

test('multi-project: only sub-project has deps and they are returned', async () => {
  const options = {
    subProject: 'subproj',
  };
  const result = await inspect(
    '.',
    path.join(multiProject, 'build.gradle'),
    options,
  );
  expect(result.dependencyGraph.rootPkg.name).toMatch('./subproj');
  expect(result.plugin.meta!.allSubProjectNames).toEqual(['subproj']);

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(-1);
});

test('multi-project: only sub-project has deps, none returned for main', async () => {
  const result = await inspect('.', path.join(multiProject, 'build.gradle'));

  expect(result.dependencyGraph.rootPkg.name).toMatch('.');

  expect(result.meta!.gradleProjectName).toMatch('root-proj');

  expect(result.plugin.meta!.allSubProjectNames).toEqual(['subproj']);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBe(0);
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
  test('multi-project: using gradle via wrapper', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project gradle wrapper'), 'build.gradle'),
    );
    expect(result.dependencyGraph.rootPkg.name).toMatch('.');
    expect(result.meta!.gradleProjectName).toMatch('root-proj');
    expect(result.meta!.versionBuildInfo!.gradleVersion).toBe('5.4.1');
    expect(result.plugin.meta!.allSubProjectNames).toEqual(['subproj']);
    // double parsing to have access to internal depGraph data, no methods available to properly
    // return the deps nodeIds list that belongs to a node
    const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
    expect(graphObject.graph.nodes[0].deps.length).toBe(0);
  });
}

test('multi-project: parallel is handled correctly', async () => {
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const result = await inspect(
    fixtureDir('multi-project-parallel'),
    'build.gradle',
  );
  expect(result.dependencyGraph.rootPkg.name).toMatch('multi-project-parallel');
  expect(result.meta!.gradleProjectName).toMatch('root-proj');

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBeGreaterThan(0);
});

test('multi-project: only sub-project has deps and they are returned space needs trimming', async () => {
  const options = {
    subProject: 'subproj ',
  };
  const result = await inspect(
    '.',
    path.join(multiProject, 'build.gradle'),
    options,
  );

  expect(result.plugin.meta!.allSubProjectNames).toEqual(['subproj']);
  expect(result.dependencyGraph.rootPkg.name).toMatch('/subproj');

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(-1);
});

test('multi-project: deps for both projects are returned with allSubProjects flag', async () => {
  const result = await inspect('.', path.join(multiProject, 'build.gradle'), {
    allSubProjects: true,
  });
  // It's an array, so we have to scan
  expect(result.scannedProjects.length).toBe(2);
  for (const p of result.scannedProjects) {
    if (p.depGraph.rootPkg.name === '.') {
      expect(p.meta!.gradleProjectName).toBe('root-proj');
      // double parsing to have access to internal depGraph data, no methods available to properly
      // return the deps nodeIds list that belongs to a node
      const graphObject: any = JSON.parse(JSON.stringify(p.depGraph));
      expect(graphObject.graph.nodes[0].deps.length).toBe(0);
      expect(p.targetFile).toBeFalsy(); // see targetFileFilteredForCompatibility
      // TODO(kyegupov): when the project name issue is solved, change the assertion to:
      // expect(p.targetFile, 'multi-project' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    } else {
      expect(p.depGraph.rootPkg.name).toBe('./subproj');
      expect(p.meta!.gradleProjectName).toBe('root-proj/subproj');

      const pkgs = p.depGraph.getDepPkgs();
      const nodeIds: string[] = [];
      Object.keys(pkgs).forEach((id) => {
        nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
      });

      expect(
        nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
      ).toBeGreaterThanOrEqual(-1);

      expect(p.targetFile).toBeFalsy(); // see targetFileFilteredForCompatibility
      // TODO(kyegupov): when the project name issue is solved, change the assertion to:
      // expect(p.targetFile, 'subproj' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    }
  }
});

test('single-project: array of one is returned with allSubProjects flag', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('api-configuration'), 'build.gradle'),
    { allSubProjects: true },
  );
  expect(result.scannedProjects.length).toBe(1);
  expect(result.scannedProjects[0].depGraph.rootPkg.name).toBe('.');
  expect(result.scannedProjects[0].meta!.gradleProjectName).toBe(
    'api-configuration',
  );

  const pkgs = result.scannedProjects[0].depGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });
  expect(
    nodeIds.indexOf('commons-httpclient:commons-httpclient@3.1'),
  ).toBeGreaterThanOrEqual(-1);
});

test('multi-project-some-unscannable: gradle-sub-project for a good subproject works', async () => {
  const options = {
    subProject: 'subproj ',
  };
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-some-unscannable'), 'build.gradle'),
    options,
  );

  expect(result.plugin.meta!.allSubProjectNames).toEqual([
    'subproj',
    'subproj-fail',
  ]);

  expect(result.dependencyGraph.rootPkg.name).toMatch('/subproj');

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(-1);
});

test('allSubProjects incompatible with gradle-sub-project', async () => {
  expect(
    inspect('.', path.join(multiProject, 'build.gradle'), {
      allSubProjects: true,
      subProject: true,
    } as api.MultiSubprojectInspectOptions),
  ).rejects.toThrowError();
});

test('multi-project: parallel with allSubProjects produces multiple results with different names', async () => {
  // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
  const result = await inspect(
    fixtureDir('multi-project-parallel'),
    'build.gradle',
    { allSubProjects: true },
  );
  expect(result.scannedProjects.length).toBe(6);
  const names = new Set<string>();
  const newNames = new Set<string>();
  for (const p of result.scannedProjects) {
    names.add(p.depGraph.rootPkg.name!);
    newNames.add(p.meta!.gradleProjectName);
    expect(p.meta!.versionBuildInfo.gradleVersion !== null);
  }
  expect(names).toEqual(
    new Set<string>([
      'multi-project-parallel',
      'multi-project-parallel/subproj0',
      'multi-project-parallel/subproj1',
      'multi-project-parallel/subproj2',
      'multi-project-parallel/subproj3',
      'multi-project-parallel/subproj4',
    ]),
  );
  expect(newNames).toEqual(
    new Set<string>([
      'root-proj',
      'root-proj/subproj0',
      'root-proj/subproj1',
      'root-proj/subproj2',
      'root-proj/subproj3',
      'root-proj/subproj4',
    ]),
  );
});

test('multi-project: allSubProjects + configuration', async () => {
  const result = await inspect('.', path.join(multiProject, 'build.gradle'), {
    allSubProjects: true,
    args: ['--configuration', 'compileClasspath'],
  });
  // It's an array, so we have to scan
  expect(result.scannedProjects.length).toBe(2);
  for (const p of result.scannedProjects) {
    if (p.depGraph.rootPkg.name === '.') {
      expect(p.meta!.gradleProjectName).toBe('root-proj');

      // double parsing to have access to internal depGraph data, no methods available to properly
      // return the deps nodeIds list that belongs to a node
      const graphObject: any = JSON.parse(JSON.stringify(p.depGraph));
      // no dependencies for the main depRoot
      expect(graphObject.graph.nodes[0].deps.length).toBe(0);
      expect(p.targetFile).toBeFalsy(); // see targetFileFilteredForCompatibility
      // TODO(kyegupov): when the project name issue is solved, change the assertion to:
      // expect(p.targetFile, 'multi-project' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    } else {
      // sub project name is included in the root pkg name
      expect(p.depGraph.rootPkg.name).toBe('./subproj');
      // new sub project name is included in the root pkg name
      expect(p.meta!.gradleProjectName).toBe('root-proj/subproj');

      const pkgs = p.depGraph.getDepPkgs();
      const nodeIds: string[] = [];
      Object.keys(pkgs).forEach((id) => {
        nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
      });
      // correct version found
      expect(nodeIds.indexOf('axis:axis@1.3')).toBeGreaterThanOrEqual(-1);
      // non-compileOnly dependency is not found
      expect(nodeIds.indexOf('com.android.tools.build:builder@2.3.0')).toBe(-1);
      // no target file returned: see targetFileFilteredForCompatibility
      expect(p.targetFile).toBeFalsy();
      // TODO(kyegupov): when the project name issue is solved, change the assertion to:
      // expect(p.targetFile, 'subproj' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
    }
  }
});

test('multi-project-dependency-cycle: scanning the main project works fine', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-dependency-cycle'), 'build.gradle'),
    {},
  );
  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('root-proj');
  expect(result.plugin.meta!.allSubProjectNames).toEqual(['subproj']);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  for (const node of graphObject.graph.nodes) {
    const { nodeId, deps } = node;
    if (nodeId === 'com.github.jitpack:subproj@unspecified') {
      // dependency cycle for sub-project is not returned in results
      expect(deps.indexOf('com.github.jitpack:root-proj@unspecified')).toBe(-1);
    }
  }
});

test('multi-project-dependency-cycle: scanning all subprojects works fine', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-dependency-cycle'), 'build.gradle'),
    { allSubProjects: true },
  );
  // It's an array, so we have to scan
  expect(result.scannedProjects.length).toBe(2);

  for (const p of result.scannedProjects) {
    if (p.depGraph.rootPkg.name === '.') {
      expect(p.meta!.gradleProjectName).toBe('root-proj');
      // double parsing to have access to internal depGraph data, no methods available to properly
      // return the deps nodeIds list that belongs to a node
      const graphObject: any = JSON.parse(JSON.stringify(p.depGraph));
      for (const node of graphObject.graph.nodes) {
        const { nodeId, deps } = node;
        if (nodeId === 'com.github.jitpack:subproj@unspecified') {
          expect(deps.indexOf('com.github.jitpack:root-proj@unspecified')).toBe(
            -1,
          );
        }
      }
    }
  }
});

test('multi-project: use full path for subprojects with the same name', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-same-name'), 'build.gradle'),
    { gradleAcceptLegacyConfigRoles: true },
  );
  expect(result.plugin.meta!.allSubProjectNames).toEqual([
    'greeter',
    'lib',
    'greeter/lib',
  ]);
});

test('multi-project: use flat naming when subprojects have different names', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-different-names'), 'build.gradle'),
    { gradleAcceptLegacyConfigRoles: true },
  );
  expect(result.plugin.meta!.allSubProjectNames).toEqual([
    'greeter',
    'lib-top',
    'lib',
  ]);
});

test('multi-project: correct deps for subprojects with the same name', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-same-name'), 'build.gradle'),
    { allSubProjects: true, gradleAcceptLegacyConfigRoles: true },
  );

  const projectDeps = {};
  for (const p of result.scannedProjects) {
    projectDeps[p.meta.projectName] = p.depGraph
      .getDepPkgs()
      .map((d) => `${d.name}@${d.version}`);
  }

  const greeterGraph = projectDeps['gradle-sandbox/greeter'];
  expect(greeterGraph.length).toBe(1);
  expect(greeterGraph).toEqual(['org.apache.commons:commons-collections4@4.4']);

  const libGraph = projectDeps['gradle-sandbox/lib'];
  expect(libGraph.length).toBe(1);
  expect(libGraph).toEqual(['org.apache.commons:commons-lang3@3.12.0']);

  const greeterLibGraph = projectDeps['gradle-sandbox/greeter/lib'];
  expect(greeterLibGraph.length).toBe(1);
  expect(greeterLibGraph).toEqual(['commons-io:commons-io@2.11.0']);
});

test('multi-project: correct deps when subprojects have different names', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-project-different-names'), 'build.gradle'),
    { allSubProjects: true, gradleAcceptLegacyConfigRoles: true },
  );

  const projectDeps = {};
  for (const p of result.scannedProjects) {
    projectDeps[p.meta.projectName] = p.depGraph
      .getDepPkgs()
      .map((d) => `${d.name}@${d.version}`);
  }

  const greeterGraph = projectDeps['gradle-sandbox/greeter'];
  expect(greeterGraph.length).toBe(1);
  expect(greeterGraph).toEqual(['org.apache.commons:commons-collections4@4.4']);

  const libGraph = projectDeps['gradle-sandbox/lib-top'];
  expect(libGraph.length).toBe(1);
  expect(libGraph).toEqual(['org.apache.commons:commons-lang3@3.12.0']);

  const greeterLibGraph = projectDeps['gradle-sandbox/lib'];
  expect(greeterLibGraph.length).toBe(1);
  expect(greeterLibGraph).toEqual(['commons-io:commons-io@2.11.0']);
});
