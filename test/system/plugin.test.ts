import * as fs from 'fs';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');
const withInitScript = fixtureDir('with-init-script');

test('run inspect()', async () => {
  const result = await inspect('.', path.join(rootNoWrapper, 'build.gradle'));
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(0);
});

test('run inspect() with gradle init script', async () => {
  const result = await inspect('.', path.join(rootNoWrapper, 'build.gradle'), {
    initScript: path.join(rootNoWrapper, 'init.gradle'),
  });
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(0);
});

test('run inspect() with on project that depends on gradle init script', async () => {
  const result = await inspect('.', path.join(withInitScript, 'build.gradle'), {
    initScript: path.join(withInitScript, 'init.gradle'),
  });
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(nodeIds.length).toBeGreaterThan(0);
  expect(
    nodeIds.indexOf('commons-collections:commons-collections@3.2.1'),
  ).toBeGreaterThanOrEqual(0);
});

test('multi-config: both compile and runtime deps picked up by default', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
  );

  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('multi-config');

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
  ).toBeGreaterThanOrEqual(0);
  expect(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5'),
  ).toBeGreaterThanOrEqual(0);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBe(6);

  expect(result.dependencyGraph.getPkgs().length).toBe(42);
});

test('multi-config: only deps for specified conf are picked up (precise match)', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { 'configuration-matching': '^compileClasspath$' },
  );
  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('multi-config');

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(nodeIds.indexOf('com.android.tools.build:builder@2.3.0')).toBe(-1);
  expect(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5'),
  ).toBeGreaterThanOrEqual(0);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBeGreaterThanOrEqual(0);
});

test('multi-config: only deps for specified conf are picked up (fuzzy match)', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { 'configuration-matching': 'pileclass' },
  ); // case-insensitive regexp matching "compileClasspath"
  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('multi-config');

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools.build:builder@2.3.0'),
  ).toBeGreaterThanOrEqual(-1);
  expect(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5'),
  ).toBeGreaterThanOrEqual(0);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBe(1);
});

test('multi-config: only deps for specified conf are picked up (using legacy CLI argument)', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { args: ['--configuration', 'compileClasspath'] },
  );
  expect(result.dependencyGraph.rootPkg.name).toBe('.');
  expect(result.meta!.gradleProjectName).toBe('multi-config');
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools.build:builder@2.3.0'),
  ).toBeGreaterThanOrEqual(-1);
  expect(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5'),
  ).toBeGreaterThanOrEqual(-1);

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  expect(graphObject.graph.nodes[0].deps.length).toBe(1);
});

test('custom dependency resolution via configurations.all is supported', async () => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('custom-resolution-strategy-via-all'), 'build.gradle'),
  );
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.2.0'),
  ).toBeGreaterThanOrEqual(-1); //forced, normally 25.3.0
});

test('custom dependency resolution via configurations* is NOT supported (known problem)', async () => {
  // See the test case for more details
  const result = await inspect(
    '.',
    path.join(
      fixtureDir('custom-resolution-strategy-via-asterisk'),
      'build.gradle',
    ),
  );

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  expect(
    nodeIds.indexOf('com.android.tools:annotations@25.2.0'),
  ).toBeGreaterThanOrEqual(-1); // 25.2.0 instead of 25.3.0 due of dependency conflict resolution
});

test('repeated transitive lines terminated at duplicate node and labeled pruned', async () => {
  const pruneSpringBeans = fixtureDir('pruned-spring-app');
  const result = await inspect(
    '.',
    path.join(pruneSpringBeans, 'build.gradle'),
  );
  const expectedJson = JSON.parse(
    fs.readFileSync(path.join(pruneSpringBeans, 'dep-graph.json'), 'utf-8'),
  );
  const expected = depGraphLib.createFromJSON(expectedJson);
  expect(result.dependencyGraph?.equals(expected)).toBe(true);
});
