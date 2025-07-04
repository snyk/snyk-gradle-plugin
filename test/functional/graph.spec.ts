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
