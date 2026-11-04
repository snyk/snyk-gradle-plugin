import * as path from 'path';
import { fixtureDir } from '../common';
import { inspect } from '../../lib';

// OSM-3958: with a root settings.gradle but no root build.gradle, the CLI's
// --all-projects passes each top-level module as its own target. Each scan
// must report only that module's subtree, or N modules become N² projects.
const fixture = fixtureDir('multi-project-no-root-build-file');

async function scannedTargetFiles(module: string): Promise<string[]> {
  const result = await inspect(
    '.',
    path.join(fixture, module, 'build.gradle'),
    {
      allSubProjects: true,
    },
  );
  return result.scannedProjects
    .map((p) => path.relative(fixture, p.meta?.targetFile as string))
    .sort();
}

describe('multi-project build with no root build file', () => {
  test('module with no children reports only itself', async () => {
    expect(await scannedTargetFiles('mod-a')).toEqual([
      path.join('mod-a', 'build.gradle'),
    ]);
  });

  test('module reports its Gradle child projects', async () => {
    expect(await scannedTargetFiles('mod-c')).toEqual([
      path.join('mod-c', 'build.gradle'),
      path.join('mod-c', 'nested', 'build.gradle'),
    ]);
  });

  test('module reports projects whose directory is under it', async () => {
    expect(await scannedTargetFiles('mod-b')).toEqual([
      path.join('mod-b', 'build.gradle'),
      path.join('mod-b', 'relocated', 'build.gradle'),
    ]);
  });

  test('scanning every top-level module covers each project exactly once', async () => {
    const all: string[] = [];
    for (const module of ['mod-a', 'mod-b', 'mod-c']) {
      all.push(...(await scannedTargetFiles(module)));
    }
    expect(all.length).toBe(5);
    expect(new Set(all).size).toBe(5);
  });
});
