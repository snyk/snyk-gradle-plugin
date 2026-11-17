import { processProjectsInExtractedJSON } from '../../lib';
import { EmptyDependencyGraphError } from '../../lib/errors';
import type { JsonDepsScriptResult } from '../../lib';

function scriptResult(
  gradleGraph: Record<
    string,
    { name: string; version: string; parentIds: string[] }
  >,
  walkFailures?: string[],
): JsonDepsScriptResult {
  return {
    defaultProject: 'app',
    defaultProjectKey: 'app',
    allSubProjectNames: ['app'],
    projects: {
      app: {
        targetFile: '/tmp/app/build.gradle',
        projectVersion: '1.0.0',
        gradleGraph,
        walkFailures,
      },
    },
  };
}

describe('empty graph from failed configuration walks', () => {
  it('throws when a configuration failed and the graph is empty', async () => {
    const failures = [
      'compileClasspath: IllegalStateException: verification failed',
    ];
    await expect(
      processProjectsInExtractedJSON(scriptResult({}, failures)),
    ).rejects.toThrow(EmptyDependencyGraphError);
    await expect(
      processProjectsInExtractedJSON(scriptResult({}, failures)),
    ).rejects.toThrow(/compileClasspath: IllegalStateException/);
  });

  it('keeps an empty graph when no configuration failed', async () => {
    const result = await processProjectsInExtractedJSON(scriptResult({}, []));
    expect(result.projects.app.depGraph?.getDepPkgs()).toHaveLength(0);
  });

  it('keeps a non-empty graph when some configuration failed', async () => {
    const result = await processProjectsInExtractedJSON(
      scriptResult(
        {
          'org.example:lib@1.0.0': {
            name: 'org.example:lib',
            version: '1.0.0',
            parentIds: ['root-node'],
          },
        },
        ['testRuntimeClasspath: Error: boom'],
      ),
    );
    expect(result.projects.app.depGraph?.getDepPkgs()).toHaveLength(1);
    expect(result.projects.app.walkFailures).toBeUndefined();
  });
});
