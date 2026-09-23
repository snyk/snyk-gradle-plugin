import * as path from 'path';
import { DepGraph } from '@snyk/dep-graph';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const noWrapper = fixtureDir('no wrapper');
const buildGradle = path.join(noWrapper, 'build.gradle');

// A fixture whose repository URL embeds credentials; see its build.gradle.
const credentialledRepo = fixtureDir('component-metadata-credentialled-repo');
const credentialledRepoBuildGradle = path.join(
  credentialledRepo,
  'build.gradle',
);

// The throwaway credentials embedded in that fixture's repository URL. The
// password contains an "@" on purpose — see the fixture's build.gradle.
const dummyUser = 'dummy-user';
const dummyPass = 'dummy-p@ss';

// Expected lowercase-hex length of each digest label the init script emits.
const hashLabelLengths: Record<string, number> = {
  'hash:md5': 32, // 16 bytes
  'hash:sha-1': 40, // 20 bytes
  'hash:sha-256': 64, // 32 bytes
  'hash:sha-512': 128, // 64 bytes
};

type LabelledNode = {
  nodeId: string;
  pkgId: string;
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

  // Covers the whole distribution:url path end to end: the resource-read
  // listener capturing a real URL, the Maven-layout match in
  // lookupDistributionUrl, and canonicalUrl dropping the userInfo.
  //
  // Not covered: canonicalUrl also strips query and fragment, which no Gradle
  // build can actually produce. Gradle normalises both off a repository URL
  // before resolution, so the listener never observes them — verified
  // empirically, not assumed. That branch is fail-safe defence against a future
  // Gradle exposing a richer location, so it stays, but it is unreachable from
  // here and a local HTTP repo would not change that.
  test('strips embedded credentials from distribution:url', async () => {
    const result = await inspect('.', credentialledRepoBuildGradle, {
      includeComponentMetadata: true,
      // distribution:url is only emitted for reads we actually observe, and a
      // warm Gradle cache re-fetches nothing. Force re-validation so the read
      // happens regardless of cache state — without this the label is
      // legitimately absent on any run after the first.
      gradleRefreshDependencies: true,
    });

    const nodes = nodesWithLabels(result.dependencyGraph as DepGraph);
    // Match on pkgId: nodeId additionally carries the artifact type
    // (batik:batik-dom:jar@1.6).
    const batik = nodes.find((n) => n.pkgId === 'batik:batik-dom@1.6');
    expect(batik).toBeDefined();

    const url = batik!.info!.labels!['distribution:url'];
    expect(url).toBe(
      'https://repo1.maven.org/maven2/batik/batik-dom/1.6/batik-dom-1.6.jar',
    );
    // Implied by the exact match above, but asserted directly so that changing
    // the expected URL can never quietly reintroduce a credential leak.
    expect(url).not.toContain(dummyUser);
    expect(url).not.toContain(dummyPass);
    expect(url).not.toContain('@');
  });

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
