import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';
import { inspect } from '../../lib';
import * as subProcess from '../../lib/sub-process';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import { CallGraph } from '@snyk/cli-interface/legacy/common';

const rootNoWrapper = fixtureDir('no wrapper');

test('run inspect()', async (t) => {
  const result = await inspect('.', path.join(rootNoWrapper, 'build.gradle'));
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    'correct version found',
  );
});

test('run inspect() with reachableVulns', async (t) => {
  const gradleCallGraph = JSON.parse(
    fs.readFileSync(
      path.join(fixtureDir('call-graphs'), 'simple.json'),
      'utf-8',
    ),
  );
  const javaCallGraphBuilderStub = sinon
    .stub(javaCallGraphBuilder, 'getCallGraphGradle')
    .resolves(gradleCallGraph as CallGraph);
  const result = await inspect('.', path.join(rootNoWrapper, 'build.gradle'), {
    reachableVulns: true,
  });
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    'correct version found',
  );
  t.ok(javaCallGraphBuilderStub.calledOnce, 'called to the call graph builder');
  t.ok(
    javaCallGraphBuilderStub.calledWith(path.join('.', rootNoWrapper)),
    'call graph builder was called with the correct path',
  );
  t.same(gradleCallGraph, result.callGraph, 'returns expected callgraph');
  t.teardown(() => {
    javaCallGraphBuilderStub.restore();
  });
});

test('multi-config: both compile and runtime deps picked up by default', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
  );
  t.equal(
    result.dependencyGraph.rootPkg.name,
    '.',
    'returned project name is not sub-project',
  );
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
    'correct version of compile+runtime dep found',
  );

  t.ok(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5') !== -1,
    'correct version of compileOnly dep found',
  );

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  const gradleVersionOutput = await subProcess.execute('gradle', ['-v'], {});
  const isGradleVersionLessThan4 =
    parseInt(gradleVersionOutput.match(/Gradle (\d+)\.\d+(\.\d+)?/)![1], 10) <
    4;

  if (isGradleVersionLessThan4) {
    t.ok(graphObject.graph.nodes[0].deps.length === 16, 'top level deps');
  } else {
    t.ok(graphObject.graph.nodes[0].deps.length === 14, 'top level deps');
  }
  t.ok(result.dependencyGraph.getPkgs().length === 42, 'same dependencies');
});

test('multi-config: only deps for specified conf are picked up (precise match)', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { 'configuration-matching': '^compileClasspath$' },
  );
  t.equal(
    result.dependencyGraph.rootPkg.name,
    '.',
    'returned project name is not sub-project',
  );
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools.build:builder@2.3.0') === -1,
    'no compile+runtime dep found',
  );

  t.ok(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5') !== -1,
    'correct version of compileOnly dep found',
  );

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  t.ok(graphObject.graph.nodes[0].deps.length === 1, 'top level deps 1');
});

test('multi-config: only deps for specified conf are picked up (fuzzy match)', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { 'configuration-matching': 'pileclass' },
  ); // case-insensitive regexp matching "compileClasspath"
  t.equal(
    result.dependencyGraph.rootPkg.name,
    '.',
    'returned project name is not sub-project',
  );
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools.build:builder@2.3.0') === -1,
    'no compile+runtime dep found',
  );

  t.ok(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5') !== -1,
    'correct version of compileOnly dep found',
  );

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  t.ok(graphObject.graph.nodes[0].deps.length === 1, 'top level deps 1');
});

test('multi-config: only deps for specified conf are picked up (using legacy CLI argument)', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { args: ['--configuration', 'compileClasspath'] },
  );
  t.equal(
    result.dependencyGraph.rootPkg.name,
    '.',
    'returned project name is not sub-project',
  );
  t.equal(
    result.meta!.gradleProjectName,
    'multi-config',
    'returned new project name is not sub-project',
  );
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools.build:builder@2.3.0') === -1,
    'no compile+runtime dep found',
  );

  t.ok(
    nodeIds.indexOf('javax.servlet:servlet-api@2.5') !== -1,
    'correct version of compileOnly dep found',
  );

  // double parsing to have access to internal depGraph data, no methods available to properly
  // return the deps nodeIds list that belongs to a node
  const graphObject: any = JSON.parse(JSON.stringify(result.dependencyGraph));
  t.ok(graphObject.graph.nodes[0].deps.length === 1, 'top level deps 1');
});

test('custom dependency resolution via configurations.all is supported', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('custom-resolution-strategy-via-all'), 'build.gradle'),
  );

  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });

  t.ok(
    nodeIds.indexOf('com.android.tools:annotations@25.2.0') !== -1, //forced, normally 25.3.0
    'overridden version found',
  );
});

test('custom dependency resolution via configurations* is NOT suppored (known problem)', async (t) => {
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

  t.ok(
    nodeIds.indexOf('com.android.tools:annotations@25.2.0') !== -1, // 25.2.0 instead of 25.3.0 due of dependency conflict resolution
    'original version found',
  );
});
