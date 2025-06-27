import { DepGraphBuilder, PkgInfo, PkgManager } from '@snyk/dep-graph';
import Queue from '@common.js/yocto-queue';

import type { Sha1Map } from './types';
import { parseCoordinate } from './coordinate';

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
  ancestry: Set<string>;
}

function precomputeChildrenMap(
  gradleGraph: GradleGraph,
): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  for (const id of Object.keys(gradleGraph)) {
    const node = gradleGraph[id];
    if (node?.parentIds) {
      for (const parentId of node.parentIds) {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(id);
      }
    }
  }
  return childrenMap;
}

function findChildren(
  parentId: string,
  ancestry: Set<string>,
  childrenMap: Map<string, string[]>,
): QueueItem[] {
  const childrenIds = childrenMap.get(parentId) || [];
  return childrenIds.map((id) => ({ id, ancestry, parentId }));
}

export async function buildGraph(
  gradleGraph: GradleGraph,
  rootPkgName: string,
  projectVersion: string,
  verbose?: boolean,
  sha1Map?: Sha1Map,
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

  const childrenMap = precomputeChildrenMap(gradleGraph);

  const visitedMap: Record<string, PkgInfo> = {};
  const queue = new Queue<QueueItem>();
  findChildren('root-node', new Set(), childrenMap).forEach((item) =>
    queue.enqueue(item),
  );

  // breadth first search
  while (queue.size > 0) {
    const item = queue.dequeue();
    if (!item) continue;
    let { id, parentId } = item;
    const { ancestry } = item;
    // take a copy as id maybe mutated below and we need this id when finding childing in GradleGraph
    const gradleGraphId = `${id}`;
    const node = gradleGraph[id];
    if (!node) continue;
    let { name = 'unknown', version = 'unknown' } = node;
    let pkgIdProvenance: string | undefined = undefined;

    if (sha1Map) {
      if (sha1Map[id]) {
        id = sha1Map[id];
        const coord = parseCoordinate(id);
        const newName = `${coord.groupId}:${coord.artifactId}`;
        const newVersion = coord.version;
        if (name !== newName || version !== newVersion) {
          pkgIdProvenance = `${name}@${version}`; // record pkg id provenance if re coordinated
          name = newName;
          version = newVersion;
        }
      }
      if (sha1Map[parentId]) {
        parentId = sha1Map[parentId];
      }
    }

    const visited = visitedMap[id];
    if (visited) {
      if (!verbose) {
        const prunedId = id + ':pruned';
        depGraphBuilder.addPkgNode(
          { name, version },
          prunedId,
          createNodeInfo(pkgIdProvenance, 'true'),
        );
        depGraphBuilder.connectDep(parentId, prunedId);
        continue; // don't queue any more children
      }

      if (ancestry.has(id)) {
        const prunedId = id + ':pruned';
        depGraphBuilder.addPkgNode(
          visited,
          prunedId,
          createNodeInfo(pkgIdProvenance, 'cyclic'),
        );
        depGraphBuilder.connectDep(parentId, prunedId);
        continue; // don't queue any more children
      }

      // Node already exists in dep graph builder
      // use visited node when omitted dependencies found (verbose)
      depGraphBuilder.connectDep(parentId, id);
    } else {
      depGraphBuilder.addPkgNode(
        { name, version },
        id,
        createNodeInfo(pkgIdProvenance),
      );
      depGraphBuilder.connectDep(parentId, id);
      visitedMap[id] = { name, version };
    }
    // Remember to push updated ancestry here
    const newAncestry = new Set(ancestry).add(id);
    findChildren(gradleGraphId, newAncestry, childrenMap).forEach((item) =>
      queue.enqueue(item),
    );
  }

  return depGraphBuilder.build();
}

function createNodeInfo(
  pkgIdProvenance?: string,
  pruned?: 'cyclic' | 'true',
): { labels: Record<string, string> } | undefined {
  const labels: Record<string, string> = {};
  if (pruned) labels.pruned = pruned;
  if (pkgIdProvenance) labels.pkgIdProvenance = pkgIdProvenance;
  return Object.keys(labels).length ? { labels } : undefined;
}
