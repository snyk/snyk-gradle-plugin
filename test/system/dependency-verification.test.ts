import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { DepGraph } from '@snyk/dep-graph';

import { getPathToFixture } from '../common';
import { inspect } from '../../lib';
import * as search from '../../lib/search';
import type { PomCoords, SnykHttpClient } from '../../lib/types';

const isWindows = process.platform === 'win32';

function guavaPkgs(depGraph: DepGraph | undefined) {
  return (depGraph?.getDepPkgs() ?? []).filter(
    (pkg) =>
      pkg.name === 'com.google.guava:guava' && pkg.version === '30.1.1-jre',
  );
}

// Gradle reports a verification failure only in the first configuration that
// resolves the artifact, so later configurations would mask a regression.
describe('dependency verification', () => {
  let projectDir: string;
  let gradleUserHome: string;
  let metadataGradleUserHome: string;
  let originalGradleUserHome: string | undefined;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-plugin-verification-'),
    );
    fs.cpSync(getPathToFixture('basic-with-deps'), projectDir, {
      recursive: true,
    });
    const wrapperPropertiesPath = path.join(
      projectDir,
      'gradle',
      'wrapper',
      'gradle-wrapper.properties',
    );
    fs.writeFileSync(
      wrapperPropertiesPath,
      fs
        .readFileSync(wrapperPropertiesPath, 'utf8')
        .replace('gradle-7.4.2-bin.zip', 'gradle-8.4-bin.zip'),
    );
    originalGradleUserHome = process.env.GRADLE_USER_HOME;
    metadataGradleUserHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-plugin-home-'),
    );
    process.env.GRADLE_USER_HOME = metadataGradleUserHome;
    execFileSync(
      path.join(projectDir, isWindows ? 'gradlew.bat' : 'gradlew'),
      ['--write-verification-metadata', 'sha512', 'compileJava'],
      { cwd: projectDir, env: process.env, shell: isWindows },
    );
    const verificationMetadataPath = path.join(
      projectDir,
      'gradle',
      'verification-metadata.xml',
    );
    const verificationMetadata = fs.readFileSync(
      verificationMetadataPath,
      'utf8',
    );
    const invalidChecksum = '0'.repeat(128);
    const corruptedMetadata = verificationMetadata.replace(
      /(<artifact name="guava-30\.1\.1-jre\.jar">\s*<sha512 value=")[^"]+/,
      `$1${invalidChecksum}`,
    );
    if (corruptedMetadata === verificationMetadata) {
      throw new Error('Could not locate the Guava checksum to corrupt');
    }
    fs.writeFileSync(verificationMetadataPath, corruptedMetadata);

    // A fresh Gradle home, so the corrupted checksum is checked against a new download.
    gradleUserHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-plugin-home-'),
    );
    fs.cpSync(
      path.join(metadataGradleUserHome, 'wrapper'),
      path.join(gradleUserHome, 'wrapper'),
      { recursive: true },
    );
    process.env.GRADLE_USER_HOME = gradleUserHome;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalGradleUserHome === undefined) {
      delete process.env.GRADLE_USER_HOME;
    } else {
      process.env.GRADLE_USER_HOME = originalGradleUserHome;
    }
    fs.rmSync(projectDir, { force: true, recursive: true });
    if (gradleUserHome) {
      fs.rmSync(gradleUserHome, { force: true, recursive: true });
    }
    if (metadataGradleUserHome) {
      fs.rmSync(metadataGradleUserHome, { force: true, recursive: true });
    }
  });

  it('keeps resolved dependencies when Gradle rejects artifact verification', async () => {
    const result = await inspect(projectDir, 'build.gradle', {
      'configuration-matching': '^compileClasspath$',
    });

    expect(guavaPkgs(result.dependencyGraph)).toHaveLength(1);
  }, 180_000);

  it('keeps resolved dependencies with gradleNormalizeDeps', async () => {
    jest
      .spyOn(search, 'getMavenPackageInfo')
      .mockImplementation(
        async (
          _sha1: string,
          depCoords: Partial<PomCoords>,
          _snykHttpClient: SnykHttpClient,
        ) => {
          const type = depCoords.type ?? '';
          const classifier = depCoords.classifier
            ? `:${depCoords.classifier}`
            : '';
          return `${depCoords.groupId}:${depCoords.artifactId}:${type}${classifier}@${depCoords.version}`;
        },
      );

    const result = await inspect(projectDir, 'build.gradle', {
      'configuration-matching': '^compileClasspath$',
      gradleNormalizeDeps: true,
    });

    expect(guavaPkgs(result.dependencyGraph)).toHaveLength(1);
  }, 180_000);
});
