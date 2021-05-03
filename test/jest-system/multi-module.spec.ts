import { inspect } from '../../lib';
import * as path from 'path';
import { fixtureDir } from '../common';

describe('handling build files for multi-projects', () => {
  //snyk monitor --file="../test/fixtures/multi-project/subproj/build.gradle"
  // cwd lib

  // if cwd is test then snyk monitor --file="./

  // root = '.'
  // targetfile = fixtures/multi-project/subproj/build.gradle"
  // when inside of a gradle mono-repo (one repo with one root project with multiplue subprojects which is a multi-module)
  //

  //check how inspect() being run from cli, so that this implementation is understood
  it('multi-project, explicitly targeting a subproject build file', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project'), 'subproj', 'build.gradle'),
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('.');
    expect(result.meta!.gradleProjectName).toBe('subproj');
    //deep equality in Jest
    expect(result.plugin.meta!.allSubProjectNames).toStrictEqual([]);
    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });
    expect(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    ).toBeTruthy();
  });

  //todo: check if this test examins a scenario when inspect() runs from 'multi-project' as root project?
  it('multi-project, ran from root, targeting subproj', async () => {
    const result = await inspect(
      fixtureDir('multi-project'),
      'subproj/build.gradle',
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('multi-project');
    expect(result.meta!.gradleProjectName).toBe('subproj');
    expect(result.plugin.meta!.allSubProjectNames).toStrictEqual([]);
    //should this be in a function returning nodeIds, if so in which file?yes- in common.ts file
    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    ).toBeTruthy();
  });

  it('multi-project, ran from a subproject directory', async () => {
    const result = await inspect(
      path.join(fixtureDir('multi-project'), 'subproj'),
      'build.gradle',
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('subproj');
    expect(result.plugin.meta!.allSubProjectNames).toStrictEqual([]);

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    ).toBeTruthy();
  });

  it('multi-project: only sub-project has deps and they are returned', async () => {
    const options = {
      subProject: 'subproj',
    };
    const result = await inspect(
      '.',
      path.join(fixtureDir('multi-project'), 'build.gradle'),
      options,
    );
    expect(result.dependencyGraph.rootPkg.name).toBe('./subproj');
    expect(result.plugin.meta!.allSubProjectNames).toStrictEqual(['subproj']);
    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    ).toBeTruthy();
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
    //what is this test testing? then should change the name so it's more indicative!
    //build.gradle file is empty- is this why the check in line 169 for empty deps?, we're just testing correct gradle version and subproj appearance?
    //why the double parsing on line 168?
    it('multi-project: using gradle via wrapper', async () => {});
  }
});
