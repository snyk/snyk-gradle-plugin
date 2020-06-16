import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';

import { inspect } from '../../lib';

let kotlinSupported = true;
const GRADLE_VERSION = process.env.GRADLE_VERSION;
if (GRADLE_VERSION) {
  const major = parseInt(GRADLE_VERSION.split('.')[0]);
  if (major < 5) {
    kotlinSupported = false;
  }
}

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
if (kotlinSupported) {
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
      t.ok(graphObject.graph.nodes[0].deps.length === 6, 'top level deps');
    },
  );
}
