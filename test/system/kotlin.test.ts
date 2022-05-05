import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const gradleVersionFromProcess: string = process.env.GRADLE_VERSION;
const gradleVersionInUse: number = parseInt(
  gradleVersionFromProcess?.split('.')[0],
);
const isKotlinSupported: boolean = gradleVersionInUse < 5 ? false : true;

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
if (isKotlinSupported) {
  test('build.gradle.kts files are supported', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'),
    );
    expect(result.dependencyGraph.rootPkg.name).toMatch('.');
    expect(result.meta!.gradleProjectName).toMatch('gradle-kts');
    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    expect(
      nodeIds.indexOf('org.jetbrains.kotlin:kotlin-stdlib-common@1.3.21') !==
        -1,
    ).toBeTruthy();

    // double parsing to have access to internal depGraph data, no methods available to properly
    // return the deps nodeIds list that belongs to a node
    const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));

    const { deps: directDependencies } = graphObject.graph.nodes[0];
    expect(directDependencies.length === 2).toBeTruthy();

    const expectedDirectDependencies = [
      { nodeId: 'org.jetbrains.kotlin:kotlin-stdlib-jdk8@1.3.21' },
      { nodeId: 'org.jetbrains.kotlin:kotlin-reflect@1.3.21' },
    ];
    expect(directDependencies).toEqual(expectedDirectDependencies);
  });
}
