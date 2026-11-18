import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inspect } from '../../lib';

// Deep enough to overflow the daemon's default thread stack under the
// recursive walker this replaced (CMPA-770): the chain resolved fine at ~250
// modules and died at ~350+, so a fixture that only proves "it still works"
// has to sit above that boundary to prove anything at all.
const MODULE_COUNT = 400;

// Project dependencies only — no repositories block, so the fixture resolves
// offline and the test measures the walker rather than the network.
function writeDeepChain(root: string, moduleCount: number): void {
  const names = Array.from({ length: moduleCount }, (_, i) => `m${i}`);
  fs.writeFileSync(
    path.join(root, 'settings.gradle'),
    [
      `rootProject.name = 'deep-chain'`,
      ...names.map((n) => `include '${n}'`),
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(root, 'build.gradle'),
    `allprojects { apply plugin: 'java-library' }\n`,
  );
  names.forEach((name, i) => {
    const dir = path.join(root, name);
    const src = path.join(dir, 'src', 'main', 'java');
    fs.mkdirSync(src, { recursive: true });
    const dep =
      i + 1 < moduleCount ? `    api project(':${names[i + 1]}')\n` : '';
    fs.writeFileSync(
      path.join(dir, 'build.gradle'),
      `dependencies {\n${dep}}\n`,
    );
    fs.writeFileSync(path.join(src, `C${i}.java`), `public class C${i} {}\n`);
  });
}

describe('deep inter-module dependency chain', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'snyk-gradle-deep-chain-'),
    );
    writeDeepChain(projectDir, MODULE_COUNT);
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it(`resolves a ${MODULE_COUNT}-module chain without exhausting the JVM thread stack`, async () => {
    // Target the head of the chain, not the root project: the root declares
    // no dependencies of its own, so scanning it would walk nothing.
    const result = await inspect(
      projectDir,
      path.join(projectDir, 'm0', 'build.gradle'),
      { 'configuration-matching': '^compileClasspath$' },
    );

    // The failure mode being guarded against is a StackOverflowError inside
    // the init script, which surfaces as a rejected inspect() rather than an
    // empty graph — but assert on the graph too, so a walker that "passes"
    // by resolving nothing does not pass.
    const pkgs = result.dependencyGraph.getDepPkgs();
    expect(pkgs.length).toBe(MODULE_COUNT - 1);
  }, 600000);
});
