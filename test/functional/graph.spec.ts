import { DepGraphBuilder } from '@snyk/dep-graph';
import { buildGraph, findChildren } from '../../lib/graph';

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
});

describe('findChildren', () => {
  it('returns empty when graph empty', () => {
    const received = findChildren('root-node', {});
    expect(received).toEqual([]);
  });
  it('returns empty when graph has no parent id', () => {
    const received = findChildren('not-found', {
      'a@1': {
        name: 'a',
        version: '1',
        parentIds: ['root-node'],
      },
    });
    expect(received).toEqual([]);
  });
  it('returns nodes with given parent id', () => {
    const received = findChildren('root-node', {
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
        parentIds: ['root-node'],
      },
    });
    expect(received).toEqual([
      { id: 'a@1', parentId: 'root-node' },
      { id: 'c@1', parentId: 'root-node' },
    ]);
  });
  it('returns nodes with given parent id when multiple parents', () => {
    const received = findChildren('root-node', {
      'a@1': {
        name: 'a',
        version: '1',
        parentIds: ['root-node'],
      },
      'b@1': {
        name: 'b',
        version: '1',
        parentIds: ['root-node', 'a@1'],
      },
      'c@1': {
        name: 'c',
        version: '1',
        parentIds: ['root-node'],
      },
    });
    expect(received).toEqual([
      { id: 'a@1', parentId: 'root-node' },
      { id: 'b@1', parentId: 'root-node' },
      { id: 'c@1', parentId: 'root-node' },
    ]);
  });
});
