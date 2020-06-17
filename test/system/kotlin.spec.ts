import * as path from 'path';
import { fixtureDir } from '../common';

import { inspect } from '../../lib';

describe('testing kotlin', () => {
  beforeEach(() => {
    jest.setTimeout(150000);
  });

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
    test('build.gradle.kts files are supported',
      async () => {
        const result = await inspect(
          '.',
          path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'),
        );
        expect(result.dependencyGraph.rootPkg.name).toBe('.');
        expect(result.meta!.gradleProjectName).toBe('gradle-kts');

        const pkgs = result.dependencyGraph.getDepPkgs();
        const nodeIds: string[] = [];
        Object.keys(pkgs).forEach((id) => {
          nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
        });

        expect(nodeIds.indexOf('org.jetbrains.kotlin:kotlin-stdlib-common@1.3.21')).not.toEqual(-1);

        // double parsing to have access to internal depGraph data, no methods available to properly
        // return the deps nodeIds list that belongs to a node
        const graphObject: any = JSON.parse(
          JSON.stringify(result.dependencyGraph),
        );
        expect(graphObject.graph.nodes[0].deps.length).toEqual(6);
      },
    );
  }
});