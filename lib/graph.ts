import { DepGraphBuilder, PkgInfo, PkgManager } from '@snyk/dep-graph';
import Queue from '@common.js/yocto-queue';

import type { Sha1Map } from './types';
import { parseCoordinate } from './coordinate';

export interface GradleGraph {
  [id: string]: {
    name: string;
    version: string;
    parentIds: string[];
    // Populated by init.gradle only under -PsnykIncludeComponentMetadata.
    hashes?: Record<string, string>;
    distributionUrl?: string;
  };
}

interface QueueItem {
  id: string;
  parentId: string;
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
  childrenMap: Map<string, string[]>,
): QueueItem[] {
  const childrenIds = childrenMap.get(parentId) || [];
  return childrenIds.map((id) => ({ id, parentId }));
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

  if (verbose) {
    return buildVerboseGraph(
      depGraphBuilder,
      gradleGraph,
      childrenMap,
      sha1Map,
    );
  }

  const visitedMap: Record<string, PkgInfo> = {};
  const queue = new Queue<QueueItem>();
  findChildren('root-node', childrenMap).forEach((item) => queue.enqueue(item));

  // breadth first search
  while (queue.size > 0) {
    const item = queue.dequeue();
    if (!item) continue;
    let { id, parentId } = item;
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
      const prunedId = id + ':pruned';
      depGraphBuilder.addPkgNode(
        { name, version },
        prunedId,
        createNodeInfo(pkgIdProvenance, 'true'),
      );
      depGraphBuilder.connectDep(parentId, prunedId);
      continue; // don't queue any more children
    } else {
      depGraphBuilder.addPkgNode(
        { name, version },
        id,
        createNodeInfo(pkgIdProvenance, undefined, {
          hashes: node.hashes,
          distributionUrl: node.distributionUrl,
        }),
      );
      depGraphBuilder.connectDep(parentId, id);
      visitedMap[id] = { name, version };
    }
    findChildren(gradleGraphId, childrenMap).forEach((item) =>
      queue.enqueue(item),
    );
  }

  return depGraphBuilder.build();
}

// The verbose graph used to be defined per path: whether an edge was drawn to a
// package or to a `:pruned` cycle placeholder depended on the ancestry of the
// route that reached it. Discovering that meant walking every route, which is
// O(paths) - on a reactor where packages are reachable many ways it takes
// minutes to hours, all of it after Gradle itself has finished.
//
// Deciding per edge instead needs two graph properties:
//
//   * `u -> v` takes part in a cycle exactly when `v` can reach `u`, i.e. they
//     share a strongly connected component;
//   * the plain edge is drawn as well exactly when some route to `u` avoids
//     `v`, i.e. `u` is still reachable from the root once `v` is removed.
//
// This is a deliberate change of definition, not a reproduction of the old one:
// see the note on `closesCycle` below.
function buildVerboseGraph(
  depGraphBuilder: DepGraphBuilder,
  gradleGraph: GradleGraph,
  childrenMap: Map<string, string[]>,
  sha1Map?: Sha1Map,
) {
  const childrenOf = (id: string): string[] =>
    (childrenMap.get(id) || []).filter((child) => !!gradleGraph[child]);

  const reachableFromRoot = (without?: string): Set<string> => {
    const reached = new Set<string>();
    const stack = childrenOf('root-node').filter((id) => id !== without);
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const child of childrenOf(id)) {
        if (child !== without && !reached.has(child)) stack.push(child);
      }
    }
    return reached;
  };

  const reachable = reachableFromRoot();
  const componentOf = findStronglyConnectedComponents(reachable, childrenOf);

  // Deciding this exactly would mean asking "is there a route from the root to
  // `from` that passes through `to`", which is the two vertex-disjoint paths
  // problem and NP-hard on a directed graph - that intractability is what the
  // old walker was paying for. The two conditions below are each necessary, so
  // this stays a safe over-approximation: it can only ever mark an extra edge
  // as cyclic, never drop a package or a real dependency edge.
  const reachableWithout = new Map<string, Set<string>>();
  const reachedWithout = (without: string): Set<string> => {
    let reached = reachableWithout.get(without);
    if (!reached) {
      reached = reachableFromRoot(without);
      reachableWithout.set(without, reached);
    }
    return reached;
  };

  // `to` has to be able to reach `from` for the edge to sit on a cycle, and
  // `to` has to be reachable without `from` for it to be able to come first on
  // any route - otherwise `to` can only ever be seen after `from` and the edge
  // is an ordinary one.
  const closesCycle = (from: string, to: string): boolean =>
    from === to ||
    (componentOf.get(from) === componentOf.get(to) &&
      reachedWithout(from).has(to));

  const routeAvoiding = (from: string, to: string): boolean =>
    reachedWithout(to).has(from);

  // sha1Map re-coordinates a package, so graph shape is keyed on the ids Gradle
  // reported while the emitted node identity uses the resolved coordinate.
  type Coordinates = {
    nodeId: string;
    name: string;
    version: string;
    pkgIdProvenance?: string;
  };
  const coordinatesCache = new Map<string, Coordinates>();
  const coordinatesOf = (id: string): Coordinates => {
    const cached = coordinatesCache.get(id);
    if (cached) return cached;
    const node = gradleGraph[id];
    let name = node?.name || 'unknown';
    let version = node?.version || 'unknown';
    let nodeId = id;
    let pkgIdProvenance: string | undefined = undefined;
    if (sha1Map && sha1Map[id]) {
      nodeId = sha1Map[id];
      const coord = parseCoordinate(nodeId);
      const newName = `${coord.groupId}:${coord.artifactId}`;
      const newVersion = coord.version;
      if (name !== newName || version !== newVersion) {
        pkgIdProvenance = `${name}@${version}`; // record pkg id provenance if re coordinated
        name = newName;
        version = newVersion;
      }
    }
    const coordinates = { nodeId, name, version, pkgIdProvenance };
    coordinatesCache.set(id, coordinates);
    return coordinates;
  };

  const added = new Set<string>();

  // The first route to reach a package cannot already contain it, so every
  // reachable package gets a node of its own.
  for (const id of reachable) {
    const coordinates = coordinatesOf(id);
    if (added.has(coordinates.nodeId)) continue;
    added.add(coordinates.nodeId);
    const node = gradleGraph[id];
    depGraphBuilder.addPkgNode(
      { name: coordinates.name, version: coordinates.version },
      coordinates.nodeId,
      createNodeInfo(coordinates.pkgIdProvenance, undefined, {
        hashes: node?.hashes,
        distributionUrl: node?.distributionUrl,
      }),
    );
  }

  // The root is never its own ancestor, so its own edges are always plain.
  for (const child of childrenOf('root-node')) {
    depGraphBuilder.connectDep('root-node', coordinatesOf(child).nodeId);
  }

  for (const from of reachable) {
    const fromNodeId = coordinatesOf(from).nodeId;
    for (const to of childrenOf(from)) {
      const coordinates = coordinatesOf(to);
      if (closesCycle(from, to)) {
        const prunedId = coordinates.nodeId + ':pruned';
        if (!added.has(prunedId)) {
          added.add(prunedId);
          depGraphBuilder.addPkgNode(
            { name: coordinates.name, version: coordinates.version },
            prunedId,
            createNodeInfo(coordinates.pkgIdProvenance, 'cyclic'),
          );
        }
        depGraphBuilder.connectDep(fromNodeId, prunedId);
        if (!routeAvoiding(from, to)) continue;
      }
      depGraphBuilder.connectDep(fromNodeId, coordinates.nodeId);
    }
  }

  return depGraphBuilder.build();
}

// Tarjan's algorithm, driven by an explicit stack: a recursive implementation
// overflows the call stack on the deep dependency chains this has to cope with
// (the same trap as CMPA-770 in lib/init.gradle).
function findStronglyConnectedComponents(
  nodeIds: Iterable<string>,
  childrenOf: (id: string) => string[],
): Map<string, number> {
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const pending: string[] = [];
  const componentOf = new Map<string, number>();
  let nextIndex = 0;
  let nextComponent = 0;

  const open = (id: string): void => {
    index.set(id, nextIndex);
    lowLink.set(id, nextIndex);
    nextIndex++;
    pending.push(id);
    onStack.add(id);
  };

  for (const start of nodeIds) {
    if (index.has(start)) continue;
    open(start);
    const work = [{ id: start, children: childrenOf(start), next: 0 }];

    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame.next < frame.children.length) {
        const child = frame.children[frame.next++];
        if (!index.has(child)) {
          open(child);
          work.push({ id: child, children: childrenOf(child), next: 0 });
        } else if (onStack.has(child)) {
          lowLink.set(
            frame.id,
            Math.min(
              lowLink.get(frame.id) as number,
              index.get(child) as number,
            ),
          );
        }
        continue;
      }

      work.pop();
      if (work.length > 0) {
        const caller = work[work.length - 1];
        lowLink.set(
          caller.id,
          Math.min(
            lowLink.get(caller.id) as number,
            lowLink.get(frame.id) as number,
          ),
        );
      }
      if (lowLink.get(frame.id) === index.get(frame.id)) {
        const component = nextComponent++;
        let member: string;
        do {
          member = pending.pop() as string;
          onStack.delete(member);
          componentOf.set(member, component);
        } while (member !== frame.id);
      }
    }
  }

  return componentOf;
}

function createNodeInfo(
  pkgIdProvenance?: string,
  pruned?: 'cyclic' | 'true',
  componentMetadata?: {
    hashes?: Record<string, string>;
    distributionUrl?: string;
  },
): { labels: Record<string, string> } | undefined {
  const labels: Record<string, string> = {};
  if (pruned) labels.pruned = pruned;
  if (pkgIdProvenance) labels.pkgIdProvenance = pkgIdProvenance;
  // Component-metadata labels use the shared cross-ecosystem vocabulary
  // (hash:<alg>, distribution:url). Present only when init.gradle emitted them.
  if (componentMetadata) {
    const { hashes, distributionUrl } = componentMetadata;
    if (hashes) {
      for (const [alg, value] of Object.entries(hashes)) {
        if (value) labels[`hash:${alg}`] = value;
      }
    }
    if (distributionUrl) labels['distribution:url'] = distributionUrl;
  }
  return Object.keys(labels).length ? { labels } : undefined;
}
