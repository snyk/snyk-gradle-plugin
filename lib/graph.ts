import { DepGraphBuilder, PkgInfo, PkgManager } from '@snyk/dep-graph';

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
  ancestry: string[];
}

export async function buildGraph(
  gradleGraph: GradleGraph,
  rootPkgName: string,
  projectVersion: string,
  verbose?: boolean,
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

  const visitedMap: Record<string, PkgInfo> = {};
  const queue: QueueItem[] = [];
  queue.push(...findChildren('root-node', [], gradleGraph)); // queue direct dependencies

  // breadth first search
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    let { id, parentId } = item;
    const { ancestry } = item;
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

    const visited = visitedMap[id];
    if (!verbose && visited) {
      const prunedId = id + ':pruned';
      depGraphBuilder.addPkgNode({ name, version }, prunedId, {
        labels: { pruned: 'true' },
      });
      depGraphBuilder.connectDep(parentId, prunedId);
      continue; // don't queue any more children
    }

    if (verbose && ancestry.includes(id)) {
      const prunedId = id + ':pruned';
      depGraphBuilder.addPkgNode(visited, prunedId, {
        labels: { pruned: 'cyclic' },
      });
      depGraphBuilder.connectDep(parentId, prunedId);
      continue; // don't queue any more children
    }

    if (verbose && visited) {
      // use visited node when omitted dependencies found (verbose)
      depGraphBuilder.addPkgNode(visited, id);
      depGraphBuilder.connectDep(parentId, id);
    } else {
      depGraphBuilder.addPkgNode({ name, version }, id);
      depGraphBuilder.connectDep(parentId, id);
      visitedMap[id] = { name, version };
    }
    // Remember to push updated ancestry here
    queue.push(...findChildren(gradleGraphId, [...ancestry, id], gradleGraph)); // queue children
  }

  return depGraphBuilder.build();
}

export function findChildren(
  parentId: string,
  ancestry: string[],
  gradleGraph: GradleGraph,
): QueueItem[] {
  const result: QueueItem[] = [];
  for (const id of Object.keys(gradleGraph)) {
    const node = gradleGraph[id];
    if (node?.parentIds?.includes(parentId)) {
      result.push({ id, ancestry, parentId });
    }
  }
  return result;
}
