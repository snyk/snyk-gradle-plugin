import { DepGraphBuilder } from '@snyk/dep-graph';
import { buildGraph, GradleGraph } from '../../lib/graph';

describe('buildGraph', () => {
  it('returns empty when graph empty', async () => {
    const received = await buildGraph({}, 'project', '1.2.3');
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expect(received.equals(expected.build())).toBe(true);
  });

  it('returns expected graph with top level dependencies', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
      },
      'project',
      '1.2.3',
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expect(received.equals(expected.build())).toBe(true);
  });
  it('returns expected graph with transitive dependencies', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
        'b@1': {
          name: 'b',
          version: '1',
          parentIds: ['a@1'],
        },
      },
      'project',
      '1.2.3',
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1');
    expected.connectDep('a@1', 'b@1');
    expect(received.equals(expected.build())).toBe(true);
  });

  it('returns expected graph with cyclic dependencies', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
        'b@1': {
          name: 'b',
          version: '1',
          parentIds: ['a@1', 'c@1'],
        },
        'c@1': {
          name: 'c',
          version: '1',
          parentIds: ['b@1'], // cycle between b and c
        },
      },
      'project',
      '1.2.3',
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1');
    expected.connectDep('a@1', 'b@1');
    expected.addPkgNode({ name: 'c', version: '1' }, 'c@1');
    expected.connectDep('b@1', 'c@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1:pruned', {
      labels: { pruned: 'true' },
    });
    expected.connectDep('c@1', 'b@1:pruned');
    expect(received.equals(expected.build())).toBe(true);
  });

  it('returns expected graph with cyclic dependencies and verbose', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
        'b@1': {
          name: 'b',
          version: '1',
          parentIds: ['a@1', 'c@1'],
        },
        'c@1': {
          name: 'c',
          version: '1',
          parentIds: ['b@1'], // cycle between b and c
        },
      },
      'project',
      '1.2.3',
      true,
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1');
    expected.connectDep('a@1', 'b@1');
    expected.addPkgNode({ name: 'c', version: '1' }, 'c@1');
    expected.connectDep('b@1', 'c@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1:pruned', {
      labels: { pruned: 'cyclic' },
    });
    expected.connectDep('c@1', 'b@1:pruned');
    expect(received.equals(expected.build())).toBe(true);
  });

  it('marks cycle edges without dropping the plain edge', async () => {
    // Pins the verbose cycle semantics, which the timing test below cannot see
    // because its graph is acyclic. `p1 -> p2` is drawn twice: once to the
    // package and once to a cycle placeholder, because p1 and p2 share a cycle
    // through p0 and p2 is reachable without p1. Deciding that exactly is
    // NP-hard, so this is a deliberate over-approximation of the old per-route
    // behaviour - the guarantee being pinned is that every package and every
    // plain edge survives, and only placeholders may be added.
    const received = await buildGraph(
      {
        'g:p0@1': {
          name: 'g:p0',
          version: '1',
          parentIds: ['root-node', 'g:p2@1'],
        },
        'g:p1@1': { name: 'g:p1', version: '1', parentIds: ['g:p0@1'] },
        'g:p2@1': {
          name: 'g:p2',
          version: '1',
          parentIds: ['g:p0@1', 'g:p1@1'],
        },
      },
      'project',
      '1.2.3',
      true,
    );
    const json = received.toJSON();
    const depsOf = (nodeId: string) =>
      (json.graph.nodes.find((node) => node.nodeId === nodeId)?.deps || [])
        .map((dep) => dep.nodeId)
        .sort();

    expect(
      received
        .getPkgs()
        .map((pkg) => pkg.name)
        .sort(),
    ).toEqual(['g:p0', 'g:p1', 'g:p2', 'project']);
    expect(depsOf('root-node')).toEqual(['g:p0@1']);
    expect(depsOf('g:p0@1')).toEqual(['g:p1@1', 'g:p2@1']);
    // the back edge onto p0 keeps only the placeholder: no route reaches p2
    // without passing through p0
    expect(depsOf('g:p2@1')).toEqual(['g:p0@1:pruned']);
    // p1 -> p2 keeps both, and the placeholder is a childless leaf
    expect(depsOf('g:p1@1')).toEqual(['g:p2@1', 'g:p2@1:pruned']);
    expect(depsOf('g:p2@1:pruned')).toEqual([]);
    for (const nodeId of ['g:p0@1:pruned', 'g:p2@1:pruned']) {
      expect(
        json.graph.nodes.find((node) => node.nodeId === nodeId)?.info?.labels,
      ).toEqual({ pruned: 'cyclic' });
    }
  });

  it('treats a sha1Map collision as a cycle rather than a self dependency', async () => {
    // sha1Map can resolve two ids Gradle reported separately onto one
    // coordinate, which collapses a parent and its child into a single package.
    // Cycles therefore have to be decided on resolved ids: deciding them on the
    // raw ones makes the two look distinct and emits a package that depends on
    // itself.
    const received = await buildGraph(
      {
        'sha1-AAAA': {
          name: 'org.example:widget',
          version: '1.0.0',
          parentIds: ['root-node'],
        },
        'sha1-BBBB': {
          name: 'org.example:widget',
          version: '1.0.0',
          parentIds: ['sha1-AAAA'],
        },
      },
      'project',
      '1.2.3',
      true,
      {
        'sha1-AAAA': 'org.example:widget:jar@1.0.0',
        'sha1-BBBB': 'org.example:widget:jar@1.0.0',
      },
    );
    const json = received.toJSON();
    const widget = json.graph.nodes.find(
      (node) => node.nodeId === 'org.example:widget:jar@1.0.0',
    );

    expect(widget?.deps.map((dep) => dep.nodeId)).toEqual([
      'org.example:widget:jar@1.0.0:pruned',
    ]);
    expect(
      json.graph.nodes.find(
        (node) => node.nodeId === 'org.example:widget:jar@1.0.0:pruned',
      )?.info?.labels,
    ).toEqual({ pruned: 'cyclic' });
  });

  it('builds a duplicate-heavy verbose graph in linear time', async () => {
    // Regression guard for exponential graph-build time in the verbose walk.
    // Every package below is reachable via many distinct routes, which is the
    // ordinary shape of a large multi-module build's verbose dependency graph.
    // Re-queueing an already-visited package's children once per incoming
    // route made this O(routes) rather than O(nodes + edges): at 28 packages
    // it took ~36s, against ~1ms here. The graph is identical either way, so
    // elapsed time is the only thing that can assert the complexity class -
    // hence a wall-clock budget, set far above the linear cost.
    const packageCount = 28;
    const fanIn = 3;
    const key = (i: number) =>
      `org.example:p${String(i).padStart(4, '0')}@1.0.0`;
    const gradleGraph: GradleGraph = {};
    for (let i = 1; i <= packageCount; i++) {
      const parentIds: string[] = [];
      for (let k = 1; k <= fanIn; k++) {
        if (i - k >= 1) parentIds.push(key(i - k));
      }
      if (i <= fanIn) parentIds.push('root-node');
      gradleGraph[key(i)] = {
        name: `org.example:p${String(i).padStart(4, '0')}`,
        version: '1.0.0',
        parentIds,
      };
    }

    const startedAt = Date.now();
    const received = await buildGraph(gradleGraph, 'project', '1.2.3', true);
    const elapsed = Date.now() - startedAt;

    // the project plus every generated package, each added exactly once
    expect(received.getPkgs()).toHaveLength(packageCount + 1);
    expect(elapsed).toBeLessThan(5000);
  });

  it('returns expected graph with repeated dependencies', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
        'b@1': {
          name: 'b',
          version: '1',
          parentIds: ['a@1'],
        },
        'c@1': {
          name: 'c',
          version: '1',
          parentIds: ['a@1', 'b@1'],
        },
      },
      'project',
      '1.2.3',
      false,
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1');
    expected.connectDep('a@1', 'b@1');
    expected.addPkgNode({ name: 'c', version: '1' }, 'c@1');
    expected.connectDep('a@1', 'c@1');
    expected.addPkgNode({ name: 'c', version: '1' }, 'c@1:pruned', {
      labels: { pruned: 'true' },
    });
    expected.connectDep('b@1', 'c@1:pruned');
    expect(received.equals(expected.build())).toBe(true);
  });

  it('returns expected graph with repeated dependencies and verbose', async () => {
    const received = await buildGraph(
      {
        'a@1': {
          name: 'a',
          version: '1',
          parentIds: ['root-node'],
        },
        'b@1': {
          name: 'b',
          version: '1',
          parentIds: ['a@1'],
        },
        'c@1': {
          name: 'c',
          version: '1',
          parentIds: ['a@1', 'b@1'], // cycle between b and c
        },
      },
      'project',
      '1.2.3',
      true,
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode({ name: 'a', version: '1' }, 'a@1');
    expected.connectDep(expected.rootNodeId, 'a@1');
    expected.addPkgNode({ name: 'b', version: '1' }, 'b@1');
    expected.connectDep('a@1', 'b@1');
    expected.addPkgNode({ name: 'c', version: '1' }, 'c@1');
    expected.connectDep('b@1', 'c@1');
    expected.connectDep('a@1', 'c@1');
    expect(received.equals(expected.build())).toBe(true);
  });

  it('returns expected graph with sha1 map', async () => {
    const received = await buildGraph(
      {
        '1234': {
          name: 'com.private:a',
          version: '1',
          parentIds: ['root-node'],
        },
        '5678': {
          name: 'com.public:b',
          version: '1',
          parentIds: ['1234'],
        },
      },
      'project',
      '1.2.3',
      false,
      {
        '1234': 'com.private:a@1',
        '5678': 'com.public:b@1',
      },
    );
    const expected = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'project', version: '1.2.3' },
    );
    expected.addPkgNode(
      { name: 'com.private:a', version: '1' },
      'com.private:a@1',
    );
    expected.connectDep(expected.rootNodeId, 'com.private:a@1');
    expected.addPkgNode(
      { name: 'com.public:b', version: '1' },
      'com.public:b@1',
    );
    expected.connectDep('com.private:a@1', 'com.public:b@1');
    expect(received.equals(expected.build())).toBe(true);
  });
  it('labels nodes with component metadata (hash:* and distribution:url)', async () => {
    const received = await buildGraph(
      {
        'com.google.guava:guava:jar@30.1.1-jre': {
          name: 'com.google.guava:guava',
          version: '30.1.1-jre',
          parentIds: ['root-node'],
          hashes: {
            'sha-1': '87e0fd1df874ea3cbe577702fe6f17068b790fd8',
            'sha-256':
              '44ce229ce26d880bf3afc362bbfcec34d7e6903d195bbb1db9f3b6e0d9834f06',
          },
          distributionUrl:
            'https://repo.maven.apache.org/maven2/com/google/guava/guava/30.1.1-jre/guava-30.1.1-jre.jar',
        },
      },
      'project',
      '1.2.3',
    );
    const nodes = received.getPkgNodes({
      name: 'com.google.guava:guava',
      version: '30.1.1-jre',
    });
    expect(nodes).toContainEqual({
      info: {
        labels: {
          'hash:sha-1': '87e0fd1df874ea3cbe577702fe6f17068b790fd8',
          'hash:sha-256':
            '44ce229ce26d880bf3afc362bbfcec34d7e6903d195bbb1db9f3b6e0d9834f06',
          'distribution:url':
            'https://repo.maven.apache.org/maven2/com/google/guava/guava/30.1.1-jre/guava-30.1.1-jre.jar',
        },
      },
    });
  });

  it('emits hash labels without distribution:url when the URL is absent (warm cache)', async () => {
    const received = await buildGraph(
      {
        'a:b:jar@1': {
          name: 'a:b',
          version: '1',
          parentIds: ['root-node'],
          hashes: { 'sha-1': 'deadbeef' },
        },
      },
      'project',
      '1.2.3',
    );
    const nodes = received.getPkgNodes({ name: 'a:b', version: '1' });
    expect(nodes).toContainEqual({
      info: { labels: { 'hash:sha-1': 'deadbeef' } },
    });
  });

  it('adds no component-metadata labels when the node carries none', async () => {
    const received = await buildGraph(
      { 'a:b:jar@1': { name: 'a:b', version: '1', parentIds: ['root-node'] } },
      'project',
      '1.2.3',
    );
    const nodes = received.getPkgNodes({ name: 'a:b', version: '1' });
    expect(nodes).toContainEqual({ info: {} });
  });

  it('labels nodes with pkgIdProvenance when the co-ordinate is changed', async () => {
    const received = await buildGraph(
      {
        '1234': {
          name: 'com.private:a',
          version: '1',
          parentIds: ['root-node'],
        },
        '5678': {
          name: 'com.public:b',
          version: '1',
          parentIds: ['1234'],
        },
      },
      'project',
      '1.2.3',
      false,
      {
        '1234': 'com.public:a@2', // co-ordinate changed (gets a label)
        '5678': 'com.public:b@1', // co-ordinate unchanged (no label)
      },
    );
    const expectLabel = received.getPkgNodes({
      name: 'com.public:a',
      version: '2',
    });
    expect(expectLabel).toContainEqual({
      info: {
        labels: {
          pkgIdProvenance: 'com.private:a@1',
        },
      },
    });
    const expectNoLabel = received.getPkgNodes({
      name: 'com.public:b',
      version: '1',
    });
    expect(expectNoLabel).toContainEqual({
      info: {},
    });
  });

  it('takes component metadata from a reachable member of a sha1Map group', async () => {
    // Several raw ids can resolve onto one coordinate, and only some of them
    // are reachable. The unreachable one contributes nothing to the graph, so
    // its metadata must not win: taking it would report the wrong sha1 and
    // drop the distributionUrl for the package that really is in the graph.
    // Sorting picks the lowest raw id, and here the lowest is the unreachable
    // one, so a plain sort gets this wrong.
    const received = await buildGraph(
      {
        'aaaa1111': {
          name: 'org.x:core',
          version: '1.0',
          parentIds: [],
          hashes: { sha1: 'sha1-of-the-unreachable-file' },
        },
        'ffff9999': {
          name: 'org.x:core',
          version: '1.0',
          parentIds: ['root-node'],
          hashes: { sha1: 'sha1-of-the-reachable-file' },
          distributionUrl: 'https://repo/org/x/core/1.0/core-1.0.jar',
        },
      },
      'project',
      '1.2.3',
      true,
      {
        'aaaa1111': 'org.x:core:jar@1.0',
        'ffff9999': 'org.x:core:jar@1.0',
      },
    );
    const node = received
      .toJSON()
      .graph.nodes.find((node) => node.nodeId === 'org.x:core:jar@1.0');

    expect(node?.info?.labels).toEqual(
      expect.objectContaining({
        'hash:sha1': 'sha1-of-the-reachable-file',
        'distribution:url': 'https://repo/org/x/core/1.0/core-1.0.jar',
      }),
    );
  });

  it('leaves a null name alone, as the non-verbose path does', async () => {
    // The default has to fire on undefined alone. Coercing null here too would
    // make one plugin report two different component identities for the same
    // Gradle output depending on --print-graph.
    const gradleGraph = {
      'g:a@1': { name: 'g:a', version: '1', parentIds: ['root-node'] },
      'g:b@2': {
        name: null as unknown as string,
        version: null as unknown as string,
        parentIds: ['g:a@1'],
      },
    };
    const namesOf = async (verbose: boolean) =>
      (await buildGraph(gradleGraph, 'project', '1.2.3', verbose))
        .getPkgs()
        .map((pkg) => `${pkg.name}@${pkg.version}`)
        .sort();

    expect(await namesOf(true)).toEqual(await namesOf(false));
  });

  it('keeps the graph when a sha1Map entry resolves onto the root id', async () => {
    // Nothing Gradle emits should hit this - sha1Map values are Maven
    // coordinates - but resolving a package onto the root's own id must not
    // let it claim the root's children and empty the whole graph.
    const received = await buildGraph(
      {
        'g:a@1': { name: 'g:a', version: '1', parentIds: ['root-node'] },
        'hh': { name: 'g:b', version: '2', parentIds: ['g:a@1'] },
      },
      'project',
      '1.2.3',
      true,
      { 'hh': 'root-node' },
    );

    expect(
      received
        .getPkgs()
        .map((pkg) => pkg.name)
        .sort(),
    ).toEqual(['g:a', 'g:b', 'project']);
  });
});
