import * as path from 'path';
import { fixtureDir } from '../common';
import {
  exportsForTests as testableMethods,
  getGradleVersion,
  inspect,
} from '../../lib';
import { legacyPlugin as api } from '@snyk/cli-interface';

const multiProject = fixtureDir('multi-project');

describe('multi-project', () => {
  let gradleVersion: string;
  let wrapperIsCompatibleWithJvm = true;
  let gradleMajor: number;
  beforeAll(async () => {
    const data = await getGradleVersion('.', 'gradle');
    const gradleVersionInfo = testableMethods.getVersionBuildInfo(data);
    gradleVersion = gradleVersionInfo?.gradleVersion || '';
    gradleMajor = parseInt(gradleVersion.split('.')[0]);
    const JDK = process.env.JDK;
    if (JDK) {
      const major = parseInt(JDK.split('.')[0]);
      if (major >= 13) {
        // see https://github.com/gradle/gradle/issues/8681
        wrapperIsCompatibleWithJvm = false;
      }
    }
  });
  test('multi-project, explicitly targeting a subproject build file', async () => {
    const result = await inspect(
      '.',
      path.join(multiProject, 'subproj', 'build.gradle'),
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('subproj');
    expect(result.meta?.gradleProjectName).toBe('subproj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([]);

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
    expect(result.dependencyGraph.rootPkg.name).toBe('subproj');
    expect(result.meta?.gradleProjectName).toBe('subproj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([]);

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
    expect(result.meta?.gradleProjectName).toBe('subproj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([]);

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
    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj/subproj');
    expect(result.meta?.gradleProjectName).toBe('root-proj/subproj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual(['subproj']);

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

    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj');

    expect(result.meta?.gradleProjectName).toBe('root-proj');

    expect(result.plugin.meta?.allSubProjectNames).toEqual(['subproj']);

    // double parsing to have access to internal depGraph data, no methods available to properly
    // return the deps nodeIds list that belongs to a node
    const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
    expect(graphObject.graph.nodes[0].deps.length).toBe(0);
  });

  if (wrapperIsCompatibleWithJvm && gradleMajor > 7) {
    test('multi-project: using gradle via wrapper', async () => {
      const result = await inspect(
        '.',
        path.join(fixtureDir('multi-project gradle wrapper'), 'build.gradle'),
      );
      expect(result.dependencyGraph.rootPkg.name).toBe('root-proj');
      expect(result.meta?.gradleProjectName).toBe('root-proj');
      expect(result.meta?.versionBuildInfo?.gradleVersion).toBe('7.6.3');
      expect(result.plugin.meta?.allSubProjectNames).toEqual(['subproj']);
      // double parsing to have access to internal depGraph data, no methods available to properly
      // return the deps nodeIds list that belongs to a node
      const graphObject: any = JSON.parse(
        JSON.stringify(result.dependencyGraph),
      );
      expect(graphObject.graph.nodes[0].deps.length).toBe(0);
    });
  }

  test('multi-project: parallel is handled correctly', async () => {
    // Note: Gradle has to be run from the directory with `gradle.properties` to pick that one up
    const result = await inspect(
      fixtureDir('multi-project-parallel'),
      'build.gradle',
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj');
    expect(result.meta?.gradleProjectName).toBe('root-proj');

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

    expect(result.plugin.meta?.allSubProjectNames).toEqual(['subproj']);
    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj/subproj');
    expect(result.meta?.gradleProjectName).toBe('root-proj/subproj');

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
      if (p.depGraph.rootPkg.name === 'root-proj') {
        expect(p.meta?.gradleProjectName).toBe('root-proj');
        // double parsing to have access to internal depGraph data, no methods available to properly
        // return the deps nodeIds list that belongs to a node
        const graphObject: any = JSON.parse(JSON.stringify(p.depGraph));
        expect(graphObject.graph.nodes[0].deps.length).toBe(0);
        expect(p.targetFile).toBeFalsy(); // see targetFileFilteredForCompatibility
        // TODO(kyegupov): when the project name issue is solved, change the assertion to:
        // expect(p.targetFile, 'multi-project' + dirSep + 'build.gradle', 'correct targetFile for the main depRoot');
      } else {
        expect(p.depGraph.rootPkg.name).toBe('root-proj/subproj');
        expect(p.meta?.gradleProjectName).toBe('root-proj/subproj');

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
    expect(result.scannedProjects[0].depGraph.rootPkg.name).toBe(
      'api-configuration',
    );
    expect(result.scannedProjects[0].meta?.gradleProjectName).toBe(
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

    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'subproj',
      'subproj-fail',
    ]);

    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj/subproj');
    expect(result.meta?.gradleProjectName).toBe('root-proj/subproj');

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('com.google.guava:guava@18.0'),
    ).toBeGreaterThanOrEqual(0);
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
      names.add(p.depGraph.rootPkg.name);
      newNames.add(p.meta?.gradleProjectName);
      expect(p.meta?.versionBuildInfo.gradleVersion !== null);
    }
    expect(names).toEqual(
      new Set<string>([
        'root-proj',
        'root-proj/subproj0',
        'root-proj/subproj1',
        'root-proj/subproj2',
        'root-proj/subproj3',
        'root-proj/subproj4',
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

  test('multi-project-dependency-cycle: scanning the main project works fine', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-dependency-cycle'), 'build.gradle'),
      {},
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('root-proj');
    expect(result.meta?.gradleProjectName).toBe('root-proj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual(['subproj']);

    // double parsing to have access to internal depGraph data, no methods available to properly
    // return the deps nodeIds list that belongs to a node
    const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
    for (const node of graphObject.graph.nodes) {
      const { nodeId, deps } = node;
      if (nodeId === 'com.github.jitpack:subproj@unspecified') {
        // dependency cycle for sub-project is not returned in results
        expect(deps.indexOf('com.github.jitpack:root-proj@unspecified')).toBe(
          -1,
        );
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
      if (p.depGraph.rootPkg.name === 'root-proj') {
        expect(p.meta?.gradleProjectName).toBe('root-proj');
        // double parsing to have access to internal depGraph data, no methods available to properly
        // return the deps nodeIds list that belongs to a node
        const graphObject: any = JSON.parse(JSON.stringify(p.depGraph));
        for (const node of graphObject.graph.nodes) {
          const { nodeId, deps } = node;
          if (nodeId === 'com.github.jitpack:subproj@unspecified') {
            expect(
              deps.indexOf('com.github.jitpack:root-proj@unspecified'),
            ).toBe(-1);
          }
        }
      }
    }
  });

  test('multi-project: use full path for subprojects with the same name', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-same-name'), 'build.gradle'),
    );
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'lib',
      'greeter/lib',
    ]);
  });

  test('multi-project: do not exclude subprojects with the same name as root', async () => {
    const result = await inspect(
      '.',
      path.join(
        fixtureDir('subproject-with-same-name-as-root'),
        'build.gradle',
      ),
    );
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'lib',
      'greeter/subproject-with-same-name-as-root',
    ]);
  });

  test('multi-project: consider matching config if it is available only in one targetted subproject', async () => {
    // only greeter module has config 'downloadJar'
    const options = {
      'configuration-matching': 'downloadJar',
      subProject: 'greeter',
    };
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-different-names'), 'build.gradle'),
      options,
    );
    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('org.apache.commons:commons-collections4@4.4'),
    ).toBeGreaterThanOrEqual(0);
  });

  test('multi-project: use flat naming when subprojects have different names', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-different-names'), 'build.gradle'),
    );
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'lib-top',
      'greeter/lib',
    ]);
  });

  test('multi-project: correct deps for subprojects with the same name', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-same-name'), 'build.gradle'),
      { allSubProjects: true },
    );

    const projectDeps = {};
    for (const p of result.scannedProjects) {
      projectDeps[p.meta.projectName] = p.depGraph
        .getDepPkgs()
        .map((d) => `${d.name}@${d.version}`);
    }

    const greeterGraph = projectDeps['gradle-sandbox/greeter'];
    expect(greeterGraph.length).toBe(1);
    expect(greeterGraph).toEqual([
      'org.apache.commons:commons-collections4@4.4',
    ]);

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
      { allSubProjects: true },
    );

    const projectDeps = {};
    for (const p of result.scannedProjects) {
      projectDeps[p.meta.projectName] = p.depGraph
        .getDepPkgs()
        .map((d) => `${d.name}@${d.version}`);
    }

    const greeterGraph = projectDeps['gradle-sandbox/greeter'];
    expect(greeterGraph.length).toBe(1);
    expect(greeterGraph).toEqual([
      'org.apache.commons:commons-collections4@4.4',
    ]);

    const libGraph = projectDeps['gradle-sandbox/lib-top'];
    expect(libGraph.length).toBe(1);
    expect(libGraph).toEqual(['org.apache.commons:commons-lang3@3.12.0']);

    const greeterLibGraph = projectDeps['gradle-sandbox/greeter/lib'];
    expect(greeterLibGraph.length).toBe(1);
    expect(greeterLibGraph).toEqual(['commons-io:commons-io@2.11.0']);
  });

  test('multi-project: correct deps for subprojects with the same name as root', async () => {
    const result = await inspect(
      '.',
      path.join(
        fixtureDir('subproject-with-same-name-as-root'),
        'build.gradle',
      ),
      { allSubProjects: true },
    );

    const projectDeps = {};
    for (const p of result.scannedProjects) {
      projectDeps[p.meta.projectName] = p.depGraph
        .getDepPkgs()
        .map((d) => `${d.name}@${d.version}`);
    }

    const rootGraph = projectDeps['subproject-with-same-name-as-root'];
    expect(rootGraph.length).toBe(8);
    expect(rootGraph).toContain('com.google.guava:guava@30.1.1-jre');

    const greeterSubprojGraph =
      projectDeps[
        'subproject-with-same-name-as-root/greeter/subproject-with-same-name-as-root'
      ];
    expect(greeterSubprojGraph.length).toBe(21);
    expect(greeterSubprojGraph).toContain(
      'org.apache.struts:struts2-spring-plugin@2.3.1',
    );
  });

  test('multi-project: correct deps for subproject with the same name, one dependent on another, using --file', async () => {
    const result = await inspect(
      '.',
      path.join(
        fixtureDir('subprojects-same-name'),
        'greeter',
        'subproj',
        'build.gradle',
      ),
    );

    expect(result.dependencyGraph.rootPkg.name).toBe('subproj');
    expect(result.meta?.gradleProjectName).toBe('subproj');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([]);

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('org.apache.struts:struts2-spring-plugin@2.3.1'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      nodeIds.indexOf('com.google.guava:guava@30.1.1-jre'),
    ).toBeGreaterThanOrEqual(0);
    expect(nodeIds.indexOf('joda-time:joda-time@2.2')).toBe(-1);
  });

  test('multi-project: right subproject to scan, using --sub-project', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('subprojects-same-name'), 'build.gradle'),
      { subProject: 'greeter/subproj' },
    );

    expect(result.dependencyGraph.rootPkg.name).toBe(
      'subprojects-same-name/greeter/subproj',
    );
    expect(result.meta?.gradleProjectName).toBe(
      'subprojects-same-name/greeter/subproj',
    );
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'subproj',
      'greeter/subproj',
    ]);
  });

  test('multi-project: correct deps for subproject with the same name, one dependent on another, using --sub-project', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('subprojects-same-name'), 'build.gradle'),
      { subProject: 'subproj' },
    );

    expect(result.dependencyGraph.rootPkg.name).toBe(
      'subprojects-same-name/subproj',
    );
    expect(result.meta?.gradleProjectName).toBe(
      'subprojects-same-name/subproj',
    );
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'subproj',
      'greeter/subproj',
    ]);

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    // expect to see only deps of the target submodule
    expect(
      nodeIds.indexOf('com.google.guava:guava@30.1.1-jre'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      nodeIds.indexOf('org.apache.struts:struts2-spring-plugin@2.3.1'),
    ).toBe(-1);
    expect(nodeIds.indexOf('joda-time:joda-time@2.2')).toBe(-1);
  });

  test('multi-project: correct deps for a nested subproject using --sub-project', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-different-names'), 'build.gradle'),
      { subProject: 'lib' },
    );

    expect(result.dependencyGraph.rootPkg.name).toBe(
      'gradle-sandbox/greeter/lib',
    );
    expect(result.meta?.gradleProjectName).toBe('gradle-sandbox/greeter/lib');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'greeter',
      'lib-top',
      'greeter/lib',
    ]);

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('commons-io:commons-io@2.11.0'),
    ).toBeGreaterThanOrEqual(0);
    expect(nodeIds.indexOf('org.apache.commons:commons-lang3@3.12.0')).toBe(-1);
  });

  test('multi-project shadow dep: process dependencies when a shadowed dep is used', async () => {
    jest.setTimeout(15_000);

    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project-shadow-dep'), 'build.gradle'),
      { subProject: 'module' },
    );

    expect(result.dependencyGraph.rootPkg.name).toBe('test/module');
    expect(result.meta?.gradleProjectName).toBe('test/module');
    expect(result.plugin.meta?.allSubProjectNames).toEqual([
      'module',
      'module/tools',
    ]);
  });
});
