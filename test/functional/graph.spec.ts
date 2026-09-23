import { DepGraphBuilder } from '@snyk/dep-graph';
import { buildGraph } from '../../lib/graph';

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
});
