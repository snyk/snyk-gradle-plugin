import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const gradleVersionFromProcess = process.env.GRADLE_VERSION || '';
const gradleVersionInUse: number = parseInt(
  gradleVersionFromProcess.split('.')[0],
);
const isKotlinSupported: boolean = gradleVersionInUse > 4 ? true : false;
const kotlinVersion = gradleVersionInUse < 7 ? '1.3.21' : '1.8.10';
const classifierMap: Record<number, string> = {
  7: ':gradle71',
  8: ':gradle76',
};

// Gradle .kts builds are slower than usual so timeout is set to 150 sec in package.json
if (isKotlinSupported) {
  test('build.gradle.kts files are supported with Gradle version > 5', async () => {
    const result = await inspect(
      '.',
      path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'),
    );
    expect(result.dependencyGraph?.rootPkg.name).toMatch('gradle-kts');
    expect(result.meta?.gradleProjectName).toMatch('gradle-kts');
    const pkgs = result.dependencyGraph?.getDepPkgs() || [];
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    const expectedNodeId = `org.jetbrains.kotlin:kotlin-stdlib-common@${kotlinVersion}`;
    expect(nodeIds).toContain(expectedNodeId);

    // double parsing to have access to internal depGraph data, no methods available to properly
    // return the deps nodeIds list that belongs to a node
    const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
    const classifier = classifierMap[gradleVersionInUse] || '';
    const { deps: directDependencies } = graphObject.graph.nodes[0];
    const expectedDirectDependencies = [
      {
        nodeId: `org.jetbrains.kotlin:kotlin-stdlib-jdk8:jar@${kotlinVersion}`,
      },
      {
        nodeId: `org.jetbrains.kotlin:kotlin-compiler-embeddable:jar@${kotlinVersion}`,
      },
      { nodeId: `org.jetbrains.kotlin:kotlin-reflect:jar@${kotlinVersion}` },
      {
        nodeId: `org.jetbrains.kotlin:kotlin-scripting-compiler-embeddable:jar@${kotlinVersion}`,
      },
      {
        nodeId: `org.jetbrains.kotlin:kotlin-allopen:jar${classifier}@${kotlinVersion}`,
      },
      {
        nodeId: `org.jetbrains.kotlin:kotlin-noarg:jar${classifier}@${kotlinVersion}`,
      },
    ];
    expectedDirectDependencies.forEach((expectedDependency) => {
      expect(directDependencies).toContainEqual(expectedDependency);
    });
  }, 200000);
} else {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  test('build.gradle.kts are not supported with Gradle version < 5', () => {});
}
