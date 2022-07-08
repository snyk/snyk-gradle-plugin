import * as path from 'path';
import * as fs from 'fs';
import { getPathToFixture } from '../common';
import { inspect } from '../../lib';
import { createFromJSON } from '@snyk/dep-graph';

// specify fixtures to test, or leave empty to test all fixtures
let fixtures: string[] = [];

if (!fixtures.length) fixtures = fs.readdirSync(getPathToFixture());

describe('inspect() fixtures', () => {
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
    });
  });
});
