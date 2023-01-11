import * as path from 'path';
import * as fs from 'fs';
import { createFromJSON } from '@snyk/dep-graph';
import { NeedleResponse } from 'needle';

import { getPathToFixture } from '../common';
import { inspect } from '../../lib';
import * as search from '../../lib/search';
import type { PomCoords, SnykHttpClient } from '../../lib/types';

// specify fixtures to test, or leave empty to test all fixtures
let fixtures: string[] = [];

if (!fixtures.length) fixtures = fs.readdirSync(getPathToFixture());

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
      const expectedDepGraph = createFromJSON(expectedDepGraphJson);

      const result = await inspect('.', pathToBuildConfig);

      const resultMatchesExpected =
        result.dependencyGraph &&
        expectedDepGraph.equals(result.dependencyGraph);

      expect(resultMatchesExpected).toBeTruthy();
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
        ) =>
          `${depCoords.groupId}:${depCoords.artifactId}@${depCoords.version}`,
      );
      const fixturePath = getPathToFixture(fixtureName);
      const buildFileName = isKotlin ? 'build.gradle.kts' : 'build.gradle';
      const pathToBuildConfig = path.join(fixturePath, buildFileName);
      const expectedDepGraphJson = require(`${fixturePath}/dep-graph.json`);
      const expectedDepGraph = createFromJSON(expectedDepGraphJson);

      const result = await inspect('.', pathToBuildConfig, {
        gradleNormalizeDeps: true,
      });

      const resultMatchesExpected =
        result.dependencyGraph &&
        expectedDepGraph.equals(result.dependencyGraph);

      expect(resultMatchesExpected).toBeTruthy();
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
      const expectedDepGraphJson = require(`${fixturePath}/dep-graph-gradleNormalizeDeps-failed-search.json`);
      const expectedDepGraph = createFromJSON(expectedDepGraphJson);

      const result = await inspect('.', pathToBuildConfig, {
        gradleNormalizeDeps: true,
      });

      const resultMatchesExpected =
        result.dependencyGraph &&
        expectedDepGraph.equals(result.dependencyGraph);

      expect(resultMatchesExpected).toBeTruthy();
    }, 100000);
  });
});
