import * as path from 'path';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./dist/test
  return path.join(__dirname, './fixtures', f);
}
