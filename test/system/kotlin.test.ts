import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';

import { inspect } from '../../lib';

const gradleVersionFromProcess = process.env.GRADLE_VERSION;
const gradleVersionInUse = parseInt(gradleVersionFromProcess?.split('.')[0]);
const isKotlinSupported = gradleVersionInUse < 5 ? false : true;

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
if (isKotlinSupported) {
  test(
    'build.gradle.kts files are supported',
    { timeout: 150000 },
    async (t) => {
      const result = await inspect(
        '.',
        path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'),
      );
      t.match(
        result.dependencyGraph.rootPkg.name,
        '.',
        'returned project name is not sub-project',
      );
      t.match(
        result.meta!.gradleProjectName,
        'gradle-kts',
        'returned new project name is not sub-project',
      );

      const pkgs = result.dependencyGraph.getDepPkgs();
      const nodeIds: string[] = [];
      Object.keys(pkgs).forEach((id) => {
        nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
      });

      t.ok(
        nodeIds.indexOf('org.jetbrains.kotlin:kotlin-stdlib-common@1.3.21') !==
          -1,
        'correct version of a dependency is found',
      );

      // double parsing to have access to internal depGraph data, no methods available to properly
      // return the deps nodeIds list that belongs to a node
      const graphObject: any = JSON.parse(
        JSON.stringify(result.dependencyGraph),
      );

      const { deps: directDependencies } = graphObject.graph.nodes[0];
      t.ok(directDependencies.length === 2, 'direct dependencies count');

      const expectedDirectDependencies = [
        { nodeId: 'org.jetbrains.kotlin:kotlin-stdlib-jdk8@1.3.21' },
        { nodeId: 'org.jetbrains.kotlin:kotlin-reflect@1.3.21' },
      ];

      t.deepEqual(
        directDependencies,
        expectedDirectDependencies,
        'validate that top level dependencies are the correct ones',
      );
    },
  );
}
