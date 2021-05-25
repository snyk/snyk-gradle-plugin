import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';
import { inspect, formatArgWithWhiteSpace } from '../../lib';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import { CallGraph, CallGraphError } from '@snyk/cli-interface/legacy/common';

const rootNoWrapper = fixtureDir('no wrapper');

test('reachableVulns', async (t) => {
  const gradleCallGraph = JSON.parse(
    fs.readFileSync(
      path.join(fixtureDir('call-graphs'), 'simple.json'),
      'utf-8',
    ),
  );
  const javaCallGraphBuilderStub = sinon
    .stub(javaCallGraphBuilder, 'getCallGraphGradle')
    .resolves(gradleCallGraph as CallGraph);

  t.test('simple reachability scenario', async (t) => {
    const result = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
      },
    );

    const pkgs = result.dependencyGraph.getDepPkgs();
    const nodeIds: string[] = [];
    Object.keys(pkgs).forEach((id) => {
      nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
    });

    t.ok(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1,
      'correct version found',
    );
    t.ok(
      javaCallGraphBuilderStub.calledOnce,
      'called to the call graph builder',
    );
    t.ok(
      javaCallGraphBuilderStub.calledWith(
        path.join('.', rootNoWrapper),
        'gradle',
      ),
      'call graph builder was called with the correct path',
    );
    t.same(gradleCallGraph, result.callGraph, 'returns expected callgraph');
  });

  t.test('with init script', async (t) => {
    const resultWithInit = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        initScript: path.join(rootNoWrapper, 'init.gradle'),
      },
    );

    t.ok(
      javaCallGraphBuilderStub.calledTwice,
      'called to the call graph builder',
    );
    t.ok(
      javaCallGraphBuilderStub.calledWith(
        path.join('.', rootNoWrapper),
        'gradle',
        formatArgWithWhiteSpace(path.join(rootNoWrapper, 'init.gradle')), // arg should be normalized with quotes
      ),
      'call graph builder was called with the correct path and init file',
    );
    t.same(
      gradleCallGraph,
      resultWithInit.callGraph,
      'returns expected callgraph',
    );
  });

  t.test('with configuration attributes', async (t) => {
    const resultWithConfigAttrs = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        'configuration-attributes':
          'buildtype:release,usage:java-runtime,newdim:appA',
      },
    );

    t.ok(
      javaCallGraphBuilderStub.calledThrice,
      'called to the call graph builder',
    );
    t.ok(
      javaCallGraphBuilderStub.calledWith(
        path.join('.', rootNoWrapper),
        'gradle',
        undefined,
        'buildtype:release,usage:java-runtime,newdim:appA',
      ),
      'call graph builder was called with the correct path and init file',
    );
    t.same(
      gradleCallGraph,
      resultWithConfigAttrs.callGraph,
      'returns expected callgraph',
    );
  });

  t.test('with timeout', async (t) => {
    const result = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        callGraphBuilderTimeout: 20,
      },
    );

    t.ok(
      javaCallGraphBuilderStub.calledWith(
        path.join('.', rootNoWrapper),
        'gradle',
        undefined,
        undefined,
        20000,
      ),
      'call graph builder was called with timeout',
    );
    t.same(gradleCallGraph, result.callGraph, 'returns expected callgraph');
  });

  t.teardown(() => {
    javaCallGraphBuilderStub.restore();
  });
});

test('failure modes', async (t) => {
  t.test('gracefully fails', async (t) => {
    const errorMessage = 'Call graph error';
    const javaCallGraphBuilderFailedStub = sinon
      .stub(javaCallGraphBuilder, 'getCallGraphGradle')
      .rejects(new Error(errorMessage));

    const result = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
      },
    );

    t.same(
      errorMessage,
      (result.callGraph as CallGraphError).message,
      'get correct error message',
    );

    javaCallGraphBuilderFailedStub.restore();
  });
});
