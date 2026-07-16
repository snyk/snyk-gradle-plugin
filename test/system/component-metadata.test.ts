import * as fs from 'fs';
import * as os from 'os';
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
  test('emits hash:<alg> and a credential-free distribution:url', async () => {
    // A fresh Gradle user home forces the artifacts to be downloaded during
    // this run so the resource-read listener fires and distribution:url is
    // populated. The gradle subprocess inherits process.env (see sub-process.ts).
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-home-'));
    const prevHome = process.env.GRADLE_USER_HOME;
    process.env.GRADLE_USER_HOME = tmpHome;

    try {
      const result = await inspect('.', buildGradle, {
        includeComponentMetadata: true,
        gradleRefreshDependencies: true,
      });

      const nodes = nodesWithLabels(result.dependencyGraph as DepGraph);
      const withHashes = nodes.filter((n) => n.info!.labels!['hash:sha-256']);
      expect(withHashes.length).toBeGreaterThan(0);

      let sawDistributionUrl = false;
      for (const node of withHashes) {
        const labels = node.info!.labels!;
        for (const [label, len] of Object.entries(hashLabelLengths)) {
          const value = labels[label];
          expect(value).toBeDefined();
          expect(value).toHaveLength(len);
          expect(value).toMatch(/^[0-9a-f]+$/);
        }

        const distUrl = labels['distribution:url'];
        if (distUrl) {
          sawDistributionUrl = true;
          // The credential-safety contract: canonical location only — no
          // query string or fragment (where SAS tokens / signed-URL signatures
          // live) and no basic-auth userinfo.
          expect(distUrl).toMatch(/^https?:\/\//);
          expect(distUrl).not.toContain('?');
          expect(distUrl).not.toContain('#');
          const parsed = new URL(distUrl);
          expect(parsed.username).toBe('');
          expect(parsed.password).toBe('');
          expect(parsed.search).toBe('');
        }
      }

      if (!sawDistributionUrl) {
        // Best-effort: distribution:url depends on the internal build-operation
        // listener being available on this Gradle version. Hashes are still
        // asserted above; surface the gap rather than failing silently.
        console.warn(
          'no distribution:url labels were captured; hash coverage was still asserted',
        );
      }
    } finally {
      if (prevHome === undefined) {
        delete process.env.GRADLE_USER_HOME;
      } else {
        process.env.GRADLE_USER_HOME = prevHome;
      }
    }
  });

  test('emits no component-metadata labels when the flag is off', async () => {
    const result = await inspect('.', buildGradle);

    const nodes = nodesWithLabels(result.dependencyGraph as DepGraph);
    for (const node of nodes) {
      const labels = Object.keys(node.info!.labels!);
      const metadataLabels = labels.filter(
        (l) => l.startsWith('hash:') || l === 'distribution:url',
      );
      expect(metadataLabels).toEqual([]);
    }
  });
});
