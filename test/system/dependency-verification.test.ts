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
const SETUP_TIMEOUT = 300_000;

const guavaCompileClasspath = [
  'com.google.code.findbugs:jsr305@3.0.2',
  'com.google.errorprone:error_prone_annotations@2.5.1',
  'com.google.guava:failureaccess@1.0.1',
  'com.google.guava:guava@30.1.1-jre',
  'com.google.guava:listenablefuture@9999.0-empty-to-avoid-conflict-with-guava',
  'com.google.j2objc:j2objc-annotations@1.3',
  'org.checkerframework:checker-qual@3.8.0',
];

function pkgIds(depGraph: DepGraph | undefined): string[] {
  return (depGraph?.getDepPkgs() ?? [])
    .map((pkg) => `${pkg.name}@${pkg.version}`)
    .sort();
}

function mockMavenSearch() {
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
}

function replaceOrThrow(text: string, pattern: string | RegExp, by: string) {
  const replaced = text.replace(pattern, by);
  if (replaced === text) {
    throw new Error(`Could not find ${pattern} to replace`);
  }
  return replaced;
}

// Copies basic-with-deps onto Gradle 8.4 with verification metadata whose
// Guava checksum is corrupted, and points GRADLE_USER_HOME at a fresh home so
// the corrupted checksum is checked against a new download. Metadata is
// written with the usual Gradle home, so the 8.4 distribution stays cached.
class VerificationFailureProject {
  readonly projectDir: string;
  private scanHome?: string;
  private readonly originalGradleUserHome = process.env.GRADLE_USER_HOME;

  constructor(buildGradle?: string) {
    this.projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-plugin-verification-'),
    );
    fs.cpSync(getPathToFixture('basic-with-deps'), this.projectDir, {
      recursive: true,
    });
    if (buildGradle) {
      fs.writeFileSync(path.join(this.projectDir, 'build.gradle'), buildGradle);
    }
    const wrapperPropertiesPath = path.join(
      this.projectDir,
      'gradle',
      'wrapper',
      'gradle-wrapper.properties',
    );
    fs.writeFileSync(
      wrapperPropertiesPath,
      replaceOrThrow(
        fs.readFileSync(wrapperPropertiesPath, 'utf8'),
        'gradle-7.4.2-bin.zip',
        'gradle-8.4-bin.zip',
      ),
    );

    const gradlew = path.join(
      this.projectDir,
      isWindows ? 'gradlew.bat' : 'gradlew',
    );
    execFileSync(
      isWindows ? `"${gradlew}"` : gradlew,
      ['--no-daemon', '--write-verification-metadata', 'sha512', 'help'],
      { cwd: this.projectDir, env: process.env, shell: isWindows },
    );
    const verificationMetadataPath = path.join(
      this.projectDir,
      'gradle',
      'verification-metadata.xml',
    );
    fs.writeFileSync(
      verificationMetadataPath,
      replaceOrThrow(
        fs.readFileSync(verificationMetadataPath, 'utf8'),
        /(<artifact name="guava-30\.1\.1-jre\.jar">\s*<sha512 value=")[^"]+/,
        `$1${'0'.repeat(128)}`,
      ),
    );

    const dist = path.join('wrapper', 'dists', 'gradle-8.4-bin');
    const metadataHome =
      this.originalGradleUserHome ?? path.join(os.homedir(), '.gradle');
    this.scanHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-plugin-home-'),
    );
    fs.cpSync(path.join(metadataHome, dist), path.join(this.scanHome, dist), {
      recursive: true,
    });
    process.env.GRADLE_USER_HOME = this.scanHome;
  }

  cleanUp() {
    if (this.originalGradleUserHome === undefined) {
      delete process.env.GRADLE_USER_HOME;
    } else {
      process.env.GRADLE_USER_HOME = this.originalGradleUserHome;
    }
    for (const dir of [this.projectDir, this.scanHome]) {
      if (dir) fs.rmSync(dir, { force: true, recursive: true });
    }
  }
}

// Gradle reports a verification failure only in the first configuration that
// resolves the artifact, so later configurations would mask a regression.
describe('dependency verification', () => {
  let project: VerificationFailureProject;

  beforeAll(() => {
    project = new VerificationFailureProject();
  }, SETUP_TIMEOUT);

  afterAll(() => project?.cleanUp());

  afterEach(() => jest.restoreAllMocks());

  it('keeps resolved dependencies when Gradle rejects artifact verification', async () => {
    const result = await inspect(project.projectDir, 'build.gradle', {
      'configuration-matching': '^compileClasspath$',
    });

    expect(pkgIds(result.dependencyGraph)).toEqual(guavaCompileClasspath);
  }, 180_000);

  it('keeps resolved dependencies with gradleNormalizeDeps', async () => {
    mockMavenSearch();

    const result = await inspect(project.projectDir, 'build.gradle', {
      'configuration-matching': '^compileClasspath$',
      gradleNormalizeDeps: true,
    });

    expect(pkgIds(result.dependencyGraph)).toEqual(guavaCompileClasspath);
  }, 180_000);
});

// aTooling resolves before compileClasspath, so it is where Gradle reports the
// failure; each configuration resolves Guava with a different failureaccess.
describe('dependency verification across configurations', () => {
  let project: VerificationFailureProject;

  beforeAll(() => {
    project = new VerificationFailureProject(`plugins {
    id 'application'
}

repositories {
    mavenCentral()
}

configurations {
    aTooling {
        resolutionStrategy.force 'com.google.guava:failureaccess:1.0'
    }
}

dependencies {
    implementation 'com.google.guava:guava:30.1.1-jre'
    aTooling 'com.google.guava:guava:30.1.1-jre'
}
`);
  }, SETUP_TIMEOUT);

  afterAll(() => project?.cleanUp());

  afterEach(() => jest.restoreAllMocks());

  const expectGuavaToHaveBothFailureaccessVersions = (
    depGraph: DepGraph | undefined,
  ) => {
    for (const version of ['1.0', '1.0.1']) {
      const pkg = { name: 'com.google.guava:failureaccess', version };
      expect(pkgIds(depGraph)).toContain(`${pkg.name}@${pkg.version}`);
      const parents = (depGraph?.pkgPathsToRoot(pkg) ?? []).map(
        (p) => `${p[1].name}@${p[1].version}`,
      );
      expect(parents).toContain('com.google.guava:guava@30.1.1-jre');
    }
  };

  it('keeps each configuration’s transitives under the failing dependency', async () => {
    const result = await inspect(project.projectDir, 'build.gradle', {
      'configuration-matching': '^(aTooling|compileClasspath)$',
    });

    expectGuavaToHaveBothFailureaccessVersions(result.dependencyGraph);
  }, 180_000);

  it('keeps each configuration’s transitives with gradleNormalizeDeps', async () => {
    mockMavenSearch();

    const result = await inspect(project.projectDir, 'build.gradle', {
      'configuration-matching': '^(aTooling|compileClasspath)$',
      gradleNormalizeDeps: true,
    });

    expectGuavaToHaveBothFailureaccessVersions(result.dependencyGraph);
  }, 180_000);
});
