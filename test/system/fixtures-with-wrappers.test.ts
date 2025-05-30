import * as path from 'path';
import * as fs from 'fs';
import { NeedleResponse } from 'needle';

import { getPathToFixture } from '../common';
import { inspect } from '../../lib';
import * as search from '../../lib/search';
import type { PomCoords, SnykHttpClient } from '../../lib/types';

// specify fixtures to test, or leave empty to test all fixtures
let fixtures: string[] = [];

if (!fixtures.length) {
  fixtures = fs
    .readdirSync(getPathToFixture())
    // TODO (@snyk/managed): ignoring lockfile test
    // there is an issue with our lockfile scanning
    // whenever guava releases a new version we end
    // up producing two versions, the locked version
    // and the new one. It looks like the new release
    // is included in the 'default' configuration
    .filter((dir) => dir !== 'with-lock-file')
    // handled by a separate test
    .filter((dir) => dir !== 'init-gradle');
}

describe('inspect() fixtures', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  fixtures.forEach((fixtureName) => {
    const isKotlin = fixtureName.startsWith('kts');
    const dsl = isKotlin ? 'Kotlin' : 'Groovy';
    test(`${dsl} fixture: ${fixtureName}`, async () => {
      const fixturePath = getPathToFixture(fixtureName);
      const buildFileName = isKotlin ? 'build.gradle.kts' : 'build.gradle';
      const pathToBuildConfig = path.join(fixturePath, buildFileName);
      const expectedDepGraphJson = require(`${fixturePath}/dep-graph.json`);

      const result = await inspect('.', pathToBuildConfig);

      expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    }, 100000);
  });

  // gradleNormalizeDeps
  fixtures.forEach((fixtureName) => {
    const isKotlin = fixtureName.startsWith('kts');
    const dsl = isKotlin ? 'Kotlin' : 'Groovy';
    test(`${dsl} fixture: ${fixtureName} - gradleNormalizeDeps`, async () => {
      jest.spyOn(search, 'getMavenPackageInfo').mockImplementation(
        async (
          _sha1: string,
          depCoords: Partial<PomCoords>,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _snykHttpClient: SnykHttpClient,
        ) => {
          const classifier = depCoords.classifier
            ? `:${depCoords.classifier}`
            : '';
          return `${depCoords.groupId}:${depCoords.artifactId}:${depCoords.type}${classifier}@${depCoords.version}`;
        },
      );
      const fixturePath = getPathToFixture(fixtureName);
      const buildFileName = isKotlin ? 'build.gradle.kts' : 'build.gradle';
      const pathToBuildConfig = path.join(fixturePath, buildFileName);
      const expectedDepGraphJson = require(`${fixturePath}/dep-graph.json`);

      const result = await inspect('.', pathToBuildConfig, {
        gradleNormalizeDeps: true,
      });

      expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    }, 100000);
  });

  // gradleNormalizeDeps - failed /packages search
  ['basic-with-deps'].forEach((fixtureName) => {
    const isKotlin = fixtureName.startsWith('kts');
    const dsl = isKotlin ? 'Kotlin' : 'Groovy';
    test(`${dsl} fixture: ${fixtureName} - gradleNormalizeDeps (failed /packages search)`, async () => {
      const mockNeedleResponse = {
        statusCode: 500,
      } as unknown as NeedleResponse;
      const snykHttpClientMock = async () => ({
        res: mockNeedleResponse,
        body: null,
      });
      const original = search.getMavenPackageInfo;
      jest.spyOn(search, 'getMavenPackageInfo').mockImplementation(
        async (
          sha1: string,
          depCoords: Partial<PomCoords>,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _snykHttpClient: SnykHttpClient,
        ) => {
          return original(sha1, depCoords, snykHttpClientMock);
        },
      );
      const fixturePath = getPathToFixture(fixtureName);
      const buildFileName = isKotlin ? 'build.gradle.kts' : 'build.gradle';
      const pathToBuildConfig = path.join(fixturePath, buildFileName);
      const expectedDepGraphJson = require(`${fixturePath}/dep-graph.json`);

      const result = await inspect('.', pathToBuildConfig, {
        gradleNormalizeDeps: true,
      });

      expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
    }, 100000);
  });

  test(`fixture: init-gradle/app with gradleNormalizeDeps`, async () => {
    jest.spyOn(search, 'getMavenPackageInfo').mockImplementation(
      async (
        _sha1: string,
        depCoords: Partial<PomCoords>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _snykHttpClient: SnykHttpClient,
      ) => {
        const classifier = depCoords.classifier
          ? `:${depCoords.classifier}`
          : '';
        return `${depCoords.groupId}:${depCoords.artifactId}:${depCoords.type}${classifier}@${depCoords.version}`;
      },
    );
    const fixturePath = getPathToFixture('init-gradle');
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    const result = await inspect(fixturePath, 'app/build.gradle', {
      gradleNormalizeDeps: true,
    });

    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
  });

  test(`fixture: init-gradle/app`, async () => {
    const fixturePath = getPathToFixture('init-gradle');
    const expectedDepGraphJson = require(`${fixturePath}/app/dep-graph.json`);

    const result = await inspect(fixturePath, 'app/build.gradle');

    expect(result.dependencyGraph?.toJSON()).toEqual(expectedDepGraphJson);
  });
});
