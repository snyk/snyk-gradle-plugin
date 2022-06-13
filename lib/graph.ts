import { DepGraphBuilder, PkgManager } from '@snyk/dep-graph';

export interface SnykGraph {
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
  snykGraph: SnykGraph,
  projectName: string,
  projectVersion: string,
) {
  const pkgManager: PkgManager = { name: 'gradle' };
  const isEmptyGraph = !snykGraph || Object.keys(snykGraph).length === 0;

  const depGraphBuilder = new DepGraphBuilder(pkgManager, {
    name: projectName,
    version: projectVersion || '0.0.0',
  });

  if (isEmptyGraph) {
    return depGraphBuilder.build();
  }

  const visited: string[] = [];
  const queue: QueueItem[] = [];
  queue.push(...findChildren('root-node', snykGraph)); // queue direct dependencies

  // breadth first search
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { id, parentId } = item;
    const node = snykGraph[id];
    if (!node) continue;
    const { name = 'unknown', version = 'unknown' } = node;
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
    queue.push(...findChildren(id, snykGraph)); // queue children
    visited.push(id);
  }

  return depGraphBuilder.build();
}

export function findChildren(
  parentId: string,
  snykGraph: SnykGraph,
): QueueItem[] {
  const result: QueueItem[] = [];
  for (const id of Object.keys(snykGraph)) {
    const node = snykGraph[id];
    if (node?.parentIds?.includes(parentId)) {
      result.push({ id, parentId });
    }
  }
  return result;
}
