import * as path from 'path';
import * as fs from 'fs';
import { DepGraphData } from '@snyk/dep-graph';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures', f);
}

export function getPathToFixture(f: string = ''): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures-with-wrappers', f);
}

// save a depGraph to a dep-graph.json file
export function createDepGraph(depGraph: DepGraphData, fixturePath: string) {
  fs.writeFileSync(
    `${fixturePath}/dep-graph.json`,
    JSON.stringify(depGraph, null, 2),
    { encoding: 'utf8' },
  );
}
