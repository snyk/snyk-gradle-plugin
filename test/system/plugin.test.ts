import * as path from 'path';
import { fixtureDir } from '../common';
import { test } from 'tap';
import { inspect } from '../../lib';
import * as subProcess from '../../lib/sub-process';

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
  t.ok(graphObject.graph.nodes[0].deps.length === 6, 'top level deps');
});

test('multi-config: only deps for specified conf are picked up (precise match)', async (t) => {
  const result = await inspect(
    '.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    { 'configuration-matching': '^compileOnly$' },
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
    { 'configuration-matching': 'pileon' },
  ); // case-insensitive regexp matching "compileOnly"
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
    { args: ['--configuration', 'compileOnly'] },
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

test('tests for Gradle 3+', async (t0) => {
  const gradleVersionOutput = await subProcess.execute('gradle', ['-v'], {});
  const isGradle3Plus =
    parseInt(gradleVersionOutput.match(/Gradle (\d+)\.\d+(\.\d+)?/)![1], 10) >=
    3;
  if (isGradle3Plus) {
    t0.test(
      'multi-config: only deps for specified conf are picked up (attribute match)',
      async (t) => {
        const result = await inspect(
          '.',
          path.join(fixtureDir('multi-config-attributes'), 'build.gradle'),
          { 'configuration-attributes': 'usage:java-api' },
        );
        t.match(
          result.dependencyGraph.rootPkg.name,
          '.',
          'returned project name is not sub-project',
        );
        t.match(
          result.meta!.gradleProjectName,
          'multi-config-attributes',
          'returned new project name is not sub-project',
        );

        const pkgs = result.dependencyGraph.getDepPkgs();
        const nodeIds: string[] = [];
        Object.keys(pkgs).forEach((id) => {
          nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
        });

        t.ok(
          nodeIds.indexOf('org.apache.commons:commons-lang3@3.8.1') === -1,
          'no runtime dep found',
        );

        t.ok(
          nodeIds.indexOf('commons-httpclient:commons-httpclient@3.1') !== -1,
          'correct version of api dep found',
        );

        // double parsing to have access to internal depGraph data, no methods available to properly
        // return the deps nodeIds list that belongs to a node
        const graphObject: any = JSON.parse(
          JSON.stringify(result.dependencyGraph),
        );
        t.ok(graphObject.graph.nodes[0].deps.length === 2, 'top level deps 2'); // 1 with good attr, 1 with no attr
      },
    );

    t0.test(
      'multi-config: only deps for specified conf are picked up (subproject variants)',
      async (t) => {
        // This test is different from the previous because of specificAttr
        // When constructing a merged configuration, it's important to scan all the subprojects and discover all the
        // values of specificAttr to make sure the configuration
        const result = await inspect(
          '.',
          path.join(
            fixtureDir('multi-config-attributes-subproject'),
            'build.gradle',
          ),
          { 'configuration-attributes': 'usage:java-api' },
        ); // there's also specificAttr but it won't be picked up
        t.equal(
          result.dependencyGraph.rootPkg.name,
          '.',
          'returned project name is not sub-project',
        );
        t.equal(
          result.meta!.gradleProjectName,
          'root-proj',
          'returned project name is `root-proj`',
        );

        const pkgs = result.dependencyGraph.getDepPkgs();
        const nodeIds: string[] = [];
        Object.keys(pkgs).forEach((id) => {
          nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
        });

        t.ok(
          nodeIds.indexOf('org.apache.commons:commons-lang3') === -1,
          'no runtime dep found',
        );

        t.ok(
          nodeIds.indexOf('commons-httpclient:commons-httpclient@3.1') !== -1,
          'correct version of api dep found',
        );

        // double parsing to have access to internal depGraph data, no methods available to properly
        // return the deps nodeIds list that belongs to a node
        const graphObject: any = JSON.parse(
          JSON.stringify(result.dependencyGraph),
        );
        t.ok(graphObject.graph.nodes[0].deps.length === 3, 'top level deps 3');
      },
    );
  }
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
    nodeIds.indexOf('com.android.tools:annotations@25.3.0') !== -1, // 25.2.0 in NOT forced
    'original version found',
  );
});
