import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../../lib';
import { createFromJSON } from '@snyk/dep-graph';

describe('handle cyclic dependencies while build dep-graph', () => {
  it('should break cycles', async () => {
    const expectedSnykGraph = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, 'expected-snyk-graph.json'),
        'utf-8',
      ),
    );
    const expectedDepGraph = createFromJSON(
      JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, 'expected-build-graph.json'),
          'utf-8',
        ),
      ),
    );

    const projectName = 'goof-project';
    const projectVersion = 'unspecified';
    const depGraph = await buildGraph(
      expectedSnykGraph,
      projectName,
      projectVersion,
    );

    const allPathsAreReacheableFromRoot = depGraph
      .getPkgs()
      .reduce((acc, pkg) => acc + depGraph.countPathsToRoot(pkg), 0);

    expect(allPathsAreReacheableFromRoot).toBeTruthy();
    expect(expectedDepGraph.equals(depGraph)).toBeTruthy();
  });
});
