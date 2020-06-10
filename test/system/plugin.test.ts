import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';
import { inspect } from '../../lib';
import * as subProcess from '../../lib/sub-process';
import * as fs from 'fs';

test('run inspect()', async (t) => {
  const fixturePath = fixtureDir('no wrapper');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
});

test('multi-config: both compile and runtime deps picked up by default', async (t) => {
  const fixturePath = fixtureDir('multi-config');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.equal(result.package.name, '.', 'returned project name is not sub-project');
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  t.equal(
    Object.keys(result.package.dependencies!).length,
    6,
    'top level deps: 6',
  );
});

test('multi-confg: only deps for specified conf are picked up (precise match)', async (t) => {
  const fixturePath = fixtureDir('multi-config');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'compileOnly-expectedTree.json'),
      'utf-8',
    ),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    'configuration-matching': '^compileOnly$',
  });
  t.equal(result.package.name, '.', 'returned project name is not sub-project');
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  t.equal(
    Object.keys(result.package.dependencies!).length,
    1,
    'top level deps: 1',
  );
});

test('multi-config: only deps for specified conf are picked up (fuzzy match)', async (t) => {
  const fixturePath = fixtureDir('multi-config');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'compileOnly-expectedTree.json'),
      'utf-8',
    ),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    'configuration-matching': 'pileon',
  }); // case-insensitive regexp matching "compileOnly"
  t.equal(result.package.name, '.', 'returned project name is not sub-project');
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  t.equal(
    Object.keys(result.package.dependencies!).length,
    1,
    'top level deps: 1',
  );
});

test('multi-confg: only deps for specified conf are picked up (using legacy CLI argument)', async (t) => {
  const fixturePath = fixtureDir('multi-config');
  const expectedResult = JSON.parse(
    fs.readFileSync(
      path.join(fixturePath, 'compileOnly-expectedTree.json'),
      'utf-8',
    ),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'), {
    args: ['--configuration', 'compileOnly'],
  });
  t.equal(result.package.name, '.', 'returned project name is not sub-project');
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  t.equal(
    Object.keys(result.package.dependencies!).length,
    1,
    'top level deps: 1',
  );
});

test('tests for Gradle 3+', async (t0) => {
  const gradleVersionOutput = await subProcess.execute('gradle', ['-v'], {});
  const isGradle3Plus =
    parseInt(gradleVersionOutput.match(/Gradle (\d+)\.\d+(\.\d+)?/)![1], 10) >=
    3;
  if (isGradle3Plus) {
    t0.test(
      'multi-config: only deps for specified conf are picked up (attribute match)',
      async (t) => {
        const fixturePath = fixtureDir('multi-config-attributes');
        const expectedResult = JSON.parse(
          fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
        );
        const result = await inspect(
          '.',
          path.join(fixturePath, 'build.gradle'),
          { 'configuration-attributes': 'usage:java-api' },
        );
        t.match(
          result.package.name,
          '.',
          'returned project name is not sub-project',
        );
        t.match(
          result.meta!.gradleProjectName,
          'multi-config-attributes',
          'returned new project name is not sub-project',
        );
        t.deepEqual(
          result,
          expectedResult,
          'plugin did not return expected result',
        );
        t.equal(
          Object.keys(result.package.dependencies!).length,
          2,
          'top level deps: 2',
        ); // 1 with good attr, 1 with no attr
      },
    );

    t0.test(
      'multi-config: only deps for specified conf are picked up (subproject variants)',
      async (t) => {
        // This test is different from the previous because of specificAttr
        // When constructing a merged configuration, it's important to scan all the subprojects and discover all the
        // values of specificAttr to make sure the configuration
        const fixturePath = fixtureDir('multi-config-attributes-subproject');
        const expectedResult = JSON.parse(
          fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
        );
        const result = await inspect(
          '.',
          path.join(fixturePath, 'build.gradle'),
          { 'configuration-attributes': 'usage:java-api' },
        ); // there's also specificAttr but it won't be picked up
        t.equal(
          result.package.name,
          '.',
          'returned project name is not sub-project',
        );
        t.equal(
          result.meta!.gradleProjectName,
          'root-proj',
          'returned project name is `root-proj`',
        );
        t.deepEqual(
          result,
          expectedResult,
          'plugin did not return expected result',
        );
        t.equal(
          Object.keys(result.package.dependencies!).length,
          3,
          'top level deps: 3',
        ); // 1 with good attr, 1 with no attr
      },
    );
  }
});

test('custom dependency resolution via configurations.all is supported', async (t) => {
  const fixturePath = fixtureDir('custom-resolution-strategy-via-all');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  // com.android.tools:annotations version is '25.2.0' forced, would normally be 25.3.0
});

test('custom dependency resolution via configurations* is NOT suppored (known problem)', async (t) => {
  // See the test case for more details
  const fixturePath = fixtureDir('custom-resolution-strategy-via-asterisk');
  const expectedResult = JSON.parse(
    fs.readFileSync(path.join(fixturePath, 'expectedTree.json'), 'utf-8'),
  );
  const result = await inspect('.', path.join(fixturePath, 'build.gradle'));
  t.deepEqual(result, expectedResult, 'plugin did not return expected result');
  // com.android.tools:annotations version is not forced, and is 25.3.0
});
