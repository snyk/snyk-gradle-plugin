import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { stub, SinonStub } from 'sinon';
import { DepGraphData } from '@snyk/dep-graph';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures', f);
}

export function getPathToFixture(f: string = ''): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures-with-wrappers', f);
}

export function stubPlatform(platform: string) {
  stub(os, 'platform').callsFake(() => {
    return platform;
  });
  return function restorePlatform() {
    (os.platform as SinonStub).restore();
  };
}

// save a depGraph to a dep-graph.json file
export function createDepGraph(depGraph: DepGraphData, fixturePath: string) {
  fs.writeFileSync(
    `${fixturePath}/dep-graph.json`,
    JSON.stringify(depGraph, null, 2),
    { encoding: 'utf8' },
  );
}
