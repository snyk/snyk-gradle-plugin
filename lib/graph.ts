import { DepGraphBuilder, PkgManager } from '@snyk/dep-graph';

import type { CoordinateMap } from './types';

export interface GradleGraph {
  [id: string]: {
    name: string;
    version: string;
    parentIds: string[];
  };
}

interface QueueItem {
  id: string;
  parentId: string;
}

export async function buildGraph(
  gradleGraph: GradleGraph,
  rootPkgName: string,
  projectVersion: string,
  coordinateMap?: CoordinateMap,
) {
  const pkgManager: PkgManager = { name: 'gradle' };
  const isEmptyGraph = !gradleGraph || Object.keys(gradleGraph).length === 0;

  const depGraphBuilder = new DepGraphBuilder(pkgManager, {
    name: rootPkgName,
    version: projectVersion || '0.0.0',
  });

  if (isEmptyGraph) {
    return depGraphBuilder.build();
  }

  const visited: string[] = [];
  const queue: QueueItem[] = [];
  queue.push(...findChildren('root-node', gradleGraph)); // queue direct dependencies

  // breadth first search
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    let { id, parentId } = item;
    // take a copy as id maybe mutated below and we need this id when finding childing in GradleGraph
    const gradleGraphId = `${id}`;
    const node = gradleGraph[id];
    if (!node) continue;
    let { name = 'unknown', version = 'unknown' } = node;

    if (coordinateMap) {
      if (coordinateMap[id]) {
        id = coordinateMap[id];
        const [newName, newVersion] = id.split('@');
        name = newName;
        version = newVersion;
      }
      if (coordinateMap[parentId]) {
        parentId = coordinateMap[parentId];
      }
    }
    if (visited.includes(id)) {
      const prunedId = id + ':pruned';
      depGraphBuilder.addPkgNode({ name, version }, prunedId, {
        labels: { pruned: 'true' },
      });
      depGraphBuilder.connectDep(parentId, prunedId);
      continue; // don't queue any more children
    }
    depGraphBuilder.addPkgNode({ name, version }, id);
    depGraphBuilder.connectDep(parentId, id);
    queue.push(...findChildren(gradleGraphId, gradleGraph)); // queue children
    visited.push(id);
  }

  return depGraphBuilder.build();
}

export function findChildren(
  parentId: string,
  gradleGraph: GradleGraph,
): QueueItem[] {
  const result: QueueItem[] = [];
  for (const id of Object.keys(gradleGraph)) {
    const node = gradleGraph[id];
    if (node?.parentIds?.includes(parentId)) {
      result.push({ id, parentId });
    }
  }
  return result;
}
