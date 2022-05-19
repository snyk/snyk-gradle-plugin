import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect, formatArgWithWhiteSpace } from '../../lib';
import * as fs from 'fs';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import { CallGraphError } from '@snyk/cli-interface/legacy/common';

const rootNoWrapper = fixtureDir('no wrapper');
let javaCallGraphBuilderMock;

describe('reachableVulns set to true and other options passed to inspect', () => {
  const gradleCallGraph = JSON.parse(
    fs.readFileSync(
      path.join(fixtureDir('call-graphs'), 'simple.json'),
      'utf-8',
    ),
  );

  beforeEach(() => {
    javaCallGraphBuilderMock = jest.spyOn(
      javaCallGraphBuilder,
      'getCallGraphGradle',
    );
    javaCallGraphBuilderMock.mockReturnValueOnce(gradleCallGraph);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('simple reachability scenario', async () => {
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

    // correct version found
    expect(
      nodeIds.indexOf('com.android.tools:annotations@25.3.0'),
    ).toBeGreaterThan(-1);
    // call graph builder was called with the correct path
    expect(javaCallGraphBuilderMock.mock.calls[0][0]).toBe(
      path.join('.', rootNoWrapper),
    );
    expect(javaCallGraphBuilderMock.mock.calls[0][1]).toBe('gradle');
    expect(gradleCallGraph).toEqual(result.callGraph);
  });

  test('with init script', async () => {
    const resultWithInit = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        initScript: path.join(rootNoWrapper, 'init.gradle'),
      },
    );

    // call graph builder was called with the correct path and init file
    expect(javaCallGraphBuilderMock.mock.calls[0][0]).toBe(
      path.join('.', rootNoWrapper),
    );
    expect(javaCallGraphBuilderMock.mock.calls[0][1]).toBe('gradle');
    expect(javaCallGraphBuilderMock.mock.calls[0][2]).toBe(
      formatArgWithWhiteSpace(path.join(rootNoWrapper, 'init.gradle')),
    ); // arg should be normalized with quotes

    expect(gradleCallGraph).toEqual(resultWithInit.callGraph);
  });

  test('with configuration attributes', async () => {
    const resultWithConfigAttrs = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        'configuration-attributes':
          'buildtype:release,usage:java-runtime,newdim:appA',
      },
    );

    expect(javaCallGraphBuilderMock.mock.calls[0][0]).toBe(
      path.join('.', rootNoWrapper),
    );
    expect(javaCallGraphBuilderMock.mock.calls[0][1]).toBe('gradle');
    expect(javaCallGraphBuilderMock.mock.calls[0][2]).toBe(undefined);
    expect(javaCallGraphBuilderMock.mock.calls[0][3]).toBe(
      'buildtype:release,usage:java-runtime,newdim:appA',
    );
    expect(gradleCallGraph).toEqual(resultWithConfigAttrs.callGraph);
  });

  test('with timeout', async () => {
    const result = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
        callGraphBuilderTimeout: 20,
      },
    );

    expect(javaCallGraphBuilderMock.mock.calls[0][0]).toBe(
      path.join('.', rootNoWrapper),
    );
    expect(javaCallGraphBuilderMock.mock.calls[0][1]).toBe('gradle');
    expect(javaCallGraphBuilderMock.mock.calls[0][2]).toBe(undefined);
    expect(javaCallGraphBuilderMock.mock.calls[0][3]).toBe(undefined);
    expect(javaCallGraphBuilderMock.mock.calls[0][4]).toBe(20_000);
    expect(gradleCallGraph).toEqual(result.callGraph);
  });
});

describe('gracefully fails when getCallGraphGradle returns an error', () => {
  beforeEach(() => {
    javaCallGraphBuilderMock = jest.spyOn(
      javaCallGraphBuilder,
      'getCallGraphGradle',
    );
    javaCallGraphBuilderMock.mockRejectedValue(new Error('Call graph error'));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('gracefully fails', async () => {
    const result = await inspect(
      '.',
      path.join(rootNoWrapper, 'build.gradle'),
      {
        reachableVulns: true,
      },
    );

    expect('Call graph error').toBe(
      (result.callGraph as CallGraphError).message,
    );
  });
});
