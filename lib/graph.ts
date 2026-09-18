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
  // sha1Map re-coordinates a package, and two ids Gradle reported separately
  // can resolve onto one coordinate. The old walk keyed its visited set and its
  // ancestry on the resolved id, so cycles were decided in resolved-id space -
  // everything below therefore works in that space too, and never in the raw
  // one. Analysing the raw graph instead makes a collapsed parent and child
  // look like two packages and emits a package that depends on itself.
  // A sha1Map entry re-coordinating some package onto the root's own id would
  // otherwise claim the root's slot in the group map below, so `childrenOf`
  // would enumerate that package's children instead of the root's and return a
  // graph holding nothing but the root. The old walk asked DepGraphBuilder to
  // overwrite the root and got an error; keeping the raw id loses nothing.
  const resolvedIdOf = (id: string): string => {
    const resolvedId = (sha1Map && sha1Map[id]) || id;
    if (resolvedId === 'root-node' && id !== 'root-node') return id;
    return resolvedId;
  };

  // Raw ids that resolve to one coordinate have to agree on the metadata they
  // contribute. The old walk took whichever the traversal happened to reach
  // first; picking the lowest raw id instead is arbitrary in the same way but
  // stable, so the emitted graph does not depend on traversal order.
  //
  // It has to be the lowest raw id the walk could actually have *reached*,
  // though. An unreachable group member contributes nothing to the graph, and
  // letting it win hands the package that member's hashes and distributionUrl
  // - so a component's sha1 comes out wrong and its distributionUrl goes
  // missing, which is exactly what an SBOM reports.
  const rawIdsByResolvedId = new Map<string, string[]>();
  for (const rawId of Object.keys(gradleGraph)) {
    const resolvedId = resolvedIdOf(rawId);
    const rawIds = rawIdsByResolvedId.get(resolvedId);
    if (rawIds) rawIds.push(rawId);
    else rawIdsByResolvedId.set(resolvedId, [rawId]);
  }
  const rawReachable = new Set<string>();
  const rawStack = [...(childrenMap.get('root-node') || [])];
  while (rawStack.length > 0) {
    const rawId = rawStack.pop() as string;
    if (rawReachable.has(rawId) || !gradleGraph[rawId]) continue;
    rawReachable.add(rawId);
    for (const child of childrenMap.get(rawId) || []) {
      if (!rawReachable.has(child)) rawStack.push(child);
    }
  }
  for (const rawIds of rawIdsByResolvedId.values()) {
    rawIds.sort((a, b) => {
      const aReached = rawReachable.has(a);
      if (aReached !== rawReachable.has(b)) return aReached ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }

  const childrenOf = (resolvedId: string): string[] => {
    const children: string[] = [];
    for (const rawId of rawIdsByResolvedId.get(resolvedId) || [resolvedId]) {
      for (const child of childrenMap.get(rawId) || []) {
        if (gradleGraph[child]) children.push(resolvedIdOf(child));
      }
    }
    return children;
  };

  const reachableFromRoot = (): Set<string> => {
    const reached = new Set<string>();
    const stack = childrenOf('root-node');
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const child of childrenOf(id)) {
        if (!reached.has(child)) stack.push(child);
      }
    }
    return reached;
  };

  const reachable = reachableFromRoot();
  const componentOf = findStronglyConnectedComponents(reachable, childrenOf);

  // `reachableFromRoot` starts from the root's children, so in its terms the
  // root is neither blockable nor reachable unless something points back at
  // it. Rooting the dominator tree at the root itself would encode the
  // opposite - that it dominates everything and nothing dominates it - and
  // give the wrong answer for any edge touching it. A separate entry keeps
  // the root an ordinary vertex.
  const dominates = buildDominanceTest(DOMINANCE_ENTRY, reachable, (id) =>
    id === DOMINANCE_ENTRY ? childrenOf('root-node') : childrenOf(id),
  );

  // `to` has to be able to reach `from` for the edge to sit on a cycle, and
  // `to` has to be reachable without `from` for it to be able to come first on
  // any route - otherwise `to` can only ever be seen after `from` and the edge
  // is an ordinary one. Both conditions are necessary but not jointly
  // sufficient: deciding it exactly asks whether a route to `from` passes
  // through `to`, which needs the two halves to be vertex-disjoint and is the
  // NP-hard two-disjoint-paths problem. So this is a deliberate
  // over-approximation - it can mark an extra edge as cyclic, and never drops
  // a package or a real dependency edge.
  const closesCycle = (from: string, to: string): boolean =>
    from === to ||
    (componentOf.get(from) === componentOf.get(to) && !dominates(from, to));

  const routeAvoiding = (from: string, to: string): boolean =>
    !dominates(to, from);

  type Coordinates = {
    name: string;
    version: string;
    pkgIdProvenance?: string;
    hashes?: Record<string, string>;
    distributionUrl?: string;
  };
  const coordinatesCache = new Map<string, Coordinates>();
  const coordinatesOf = (resolvedId: string): Coordinates => {
    const cached = coordinatesCache.get(resolvedId);
    if (cached) return cached;
    const rawId = (rawIdsByResolvedId.get(resolvedId) || [resolvedId])[0];
    const node = gradleGraph[rawId];
    // Destructuring, not `??`: the default has to fire on undefined alone, as
    // it does on the non-verbose path above. `??` would also swallow a null
    // name, so one plugin would report two different component identities for
    // the same Gradle output depending on --print-graph.
    let { name = 'unknown', version = 'unknown' } = node || {};
    let pkgIdProvenance: string | undefined = undefined;
    // Compare rather than just test for presence: when the guard in
    // `resolvedIdOf` has declined a sha1Map entry, the resolved id is the raw
    // one and re-coordinating against it would parse a sha1 hash as a Maven
    // coordinate.
    if (sha1Map && sha1Map[rawId] === resolvedId) {
      const coord = parseCoordinate(resolvedId);
      const newName = `${coord.groupId}:${coord.artifactId}`;
      const newVersion = coord.version;
      if (name !== newName || version !== newVersion) {
        pkgIdProvenance = `${name}@${version}`; // record pkg id provenance if re coordinated
        name = newName;
        version = newVersion;
      }
    }
    const coordinates = {
      name,
      version,
      pkgIdProvenance,
      hashes: node?.hashes,
      distributionUrl: node?.distributionUrl,
    };
    coordinatesCache.set(resolvedId, coordinates);
    return coordinates;
  };

  const added = new Set<string>();

  // The first route to reach a package cannot already contain it, so every
  // reachable package gets a node of its own.
  for (const id of reachable) {
    const coordinates = coordinatesOf(id);
    added.add(id);
    depGraphBuilder.addPkgNode(
      { name: coordinates.name, version: coordinates.version },
      id,
      createNodeInfo(coordinates.pkgIdProvenance, undefined, {
        hashes: coordinates.hashes,
        distributionUrl: coordinates.distributionUrl,
      }),
    );
  }

  // The root is never its own ancestor, so its own edges are always plain.
  for (const child of childrenOf('root-node')) {
    depGraphBuilder.connectDep(resolvedIdOf('root-node'), child);
  }

  for (const from of reachable) {
    for (const to of childrenOf(from)) {
      if (closesCycle(from, to)) {
        const prunedId = to + ':pruned';
        if (!added.has(prunedId)) {
          added.add(prunedId);
          const coordinates = coordinatesOf(to);
          depGraphBuilder.addPkgNode(
            { name: coordinates.name, version: coordinates.version },
            prunedId,
            createNodeInfo(coordinates.pkgIdProvenance, 'cyclic'),
          );
        }
        depGraphBuilder.connectDep(from, prunedId);
        if (!routeAvoiding(from, to)) continue;
      }
      depGraphBuilder.connectDep(from, to);
    }
  }

  return depGraphBuilder.build();
}

// A node id the graph cannot contain, so the dominator tree can have an entry
// of its own that is distinct from the dependency graph's root.
const DOMINANCE_ENTRY = '\u0000dominance-entry';

// `to` is reachable from the root without `from` exactly when `from` does not
// dominate `to`, so one dominator tree answers every such question in constant
// time. Answering them with a reachability pass per cycle member instead cost
// O(cycle members x nodes) in both time and memory, which is worse than the
// walk it replaced on a graph made of many small cycles.
function buildDominanceTest(
  rootId: string,
  reachable: Set<string>,
  childrenOf: (id: string) => string[],
): (dominator: string, id: string) => boolean {
  const childrenIn = (id: string): string[] =>
    childrenOf(id).filter((child) => reachable.has(child));

  // depth-first postorder, then reversed, so every node follows its
  // predecessors wherever the graph is acyclic
  const postorder: string[] = [];
  const seen = new Set<string>([rootId]);
  const dfs = [{ id: rootId, children: childrenIn(rootId), next: 0 }];
  while (dfs.length > 0) {
    const frame = dfs[dfs.length - 1];
    if (frame.next < frame.children.length) {
      const child = frame.children[frame.next++];
      if (seen.has(child)) continue;
      seen.add(child);
      dfs.push({ id: child, children: childrenIn(child), next: 0 });
      continue;
    }
    postorder.push(frame.id);
    dfs.pop();
  }
  const order = postorder.reverse();
  const rank = new Map<string, number>();
  order.forEach((id, position) => rank.set(id, position));

  const predecessors = new Map<string, string[]>();
  for (const id of order) {
    for (const child of childrenIn(id)) {
      if (!rank.has(child)) continue;
      const known = predecessors.get(child);
      if (known) known.push(id);
      else predecessors.set(child, [id]);
    }
  }

  // Cooper, Harvey and Kennedy's iterative formulation
  const idom = new Map<string, string>([[rootId, rootId]]);
  const commonDominator = (left: string, right: string): string => {
    let a = left;
    let b = right;
    while (a !== b) {
      while ((rank.get(a) as number) > (rank.get(b) as number))
        a = idom.get(a) as string;
      while ((rank.get(b) as number) > (rank.get(a) as number))
        b = idom.get(b) as string;
    }
    return a;
  };
  let settled = false;
  while (!settled) {
    settled = true;
    for (const id of order) {
      if (id === rootId) continue;
      let candidate: string | undefined;
      for (const predecessor of predecessors.get(id) || []) {
        if (!idom.has(predecessor)) continue;
        candidate =
          candidate === undefined
            ? predecessor
            : commonDominator(predecessor, candidate);
      }
      if (candidate !== undefined && idom.get(id) !== candidate) {
        idom.set(id, candidate);
        settled = false;
      }
    }
  }

  // Entry and exit stamps over the dominator tree turn dominance into a range
  // check: one node dominates another when its interval encloses it.
  const treeChildren = new Map<string, string[]>();
  for (const [id, parent] of idom) {
    if (id === rootId) continue;
    const known = treeChildren.get(parent);
    if (known) known.push(id);
    else treeChildren.set(parent, [id]);
  }
  const entered = new Map<string, number>();
  const exited = new Map<string, number>();
  let clock = 0;
  entered.set(rootId, clock++);
  const walk = [
    { id: rootId, children: treeChildren.get(rootId) || [], next: 0 },
  ];
  while (walk.length > 0) {
    const frame = walk[walk.length - 1];
    if (frame.next < frame.children.length) {
      const child = frame.children[frame.next++];
      if (entered.has(child)) continue;
      entered.set(child, clock++);
      walk.push({
        id: child,
        children: treeChildren.get(child) || [],
        next: 0,
      });
      continue;
    }
    exited.set(frame.id, clock++);
    walk.pop();
  }

  return (dominator: string, id: string): boolean => {
    const from = entered.get(dominator);
    const to = entered.get(id);
    if (from === undefined || to === undefined) return false;
    return (
      from <= to &&
      (exited.get(id) as number) <= (exited.get(dominator) as number)
    );
  };
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
