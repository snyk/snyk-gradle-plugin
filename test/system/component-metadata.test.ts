import * as path from 'path';
import { DepGraph } from '@snyk/dep-graph';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const noWrapper = fixtureDir('no wrapper');
const buildGradle = path.join(noWrapper, 'build.gradle');

// Expected lowercase-hex length of each digest label the init script emits.
const hashLabelLengths: Record<string, number> = {
  'hash:md5': 32, // 16 bytes
  'hash:sha-1': 40, // 20 bytes
  'hash:sha-256': 64, // 32 bytes
  'hash:sha-512': 128, // 64 bytes
};

type LabelledNode = {
  nodeId: string;
  info?: { labels?: Record<string, string> };
};

function nodesWithLabels(depGraph: DepGraph): LabelledNode[] {
  const json = depGraph.toJSON();
  return (json.graph.nodes as LabelledNode[]).filter(
    (n) => n.info && n.info.labels,
  );
}

describe('includeComponentMetadata', () => {
  test('emits hash:<alg> labels for resolved artifacts', async () => {
    const result = await inspect('.', buildGradle, {
      includeComponentMetadata: true,
    });

    const nodes = nodesWithLabels(result.dependencyGraph as DepGraph);
    const withHashes = nodes.filter((n) => n.info!.labels!['hash:sha-256']);
    expect(withHashes.length).toBeGreaterThan(0);

    for (const node of withHashes) {
      const labels = node.info!.labels!;
      for (const [label, len] of Object.entries(hashLabelLengths)) {
        const value = labels[label];
        expect(value).toBeDefined();
        expect(value).toHaveLength(len);
        expect(value).toMatch(/^[0-9a-f]+$/);
      }
    }
  });

  // NOTE: distribution:url is intentionally not asserted here. This fixture
  // resolves from Maven Central, whose URLs carry no credentials/query, so it
  // cannot exercise the credential-stripping (canonicalUrl) logic — a passing
  // assertion would give false certainty. Meaningfully testing distribution:url
  // (and the stripping) needs a controlled local HTTP repo serving artifacts
  // via query-string URLs; tracked as a follow-up.

  test('emits no component-metadata labels when the flag is off', async () => {
    const result = await inspect('.', buildGradle);

    const nodes = nodesWithLabels(result.dependencyGraph as DepGraph);
    for (const node of nodes) {
      const metadataLabels = Object.keys(node.info!.labels!).filter(
        (l) => l.startsWith('hash:') || l === 'distribution:url',
      );
      expect(metadataLabels).toEqual([]);
    }
  });
});
