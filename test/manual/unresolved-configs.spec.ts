import * as fs from 'fs';
import * as path from 'path';
import { inspect } from '../../lib';
import { fixtureDir } from '../common';
import { createFromJSON } from '@snyk/dep-graph';

const JEST_TIMEOUT = 10000;
// Bear in mind that unresolvable configs e.g. incrementalScalaAnalysisForgatling cannot compute a depGraph,
// for this reason we should just ignore it instead of make the whole process fail, since it provide no info to be scanned
describe('successful scan gradle projects even if they contain submodules with unresolvable configs', () => {
  it(
    'multi-project-some-unscannable: allSubProjects pass even if a single subproj is unresolved',
    async () => {
      const result = await inspect(
        '.',
        path.join(fixtureDir('multi-project-some-unscannable'), 'build.gradle'),
        { allSubProjects: true },
      );

      // sub-project success has resolved deps while sub-proj-fail that was unresolved and root with no deps will have 0 deps
      expect(result.scannedProjects[1].depGraph.getDepPkgs().length).toBe(41);
    },
    JEST_TIMEOUT,
  );

  it('should successfully scan even if some custom configs are unresolvable (cannot compute depGraph)', async () => {
    const buildGradle = path.join(
      fixtureDir('successful-scan-with-unresolved-custom-configs'),
      'build.gradle',
    );

    const expectedDepGraphJSON = fs.readFileSync(
      path.join(
        fixtureDir('successful-scan-with-unresolved-custom-configs'),
        'expected-depgraph.json',
      ),
      'utf-8',
    );
    const expectedDepGraph = createFromJSON(JSON.parse(expectedDepGraphJSON));

    const data = await inspect('.', buildGradle);
    const depGraph = data.dependencyGraph;

    const allPathsAreReacheableFromRoot = depGraph
      .getPkgs()
      .reduce((acc, pkg) => acc + depGraph.countPathsToRoot(pkg), 0);

    expect(allPathsAreReacheableFromRoot).toBeTruthy();
    expect(depGraph.equals(expectedDepGraph)).toBeTruthy();
  });
});
