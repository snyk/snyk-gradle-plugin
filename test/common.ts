import * as path from 'path';
import * as os from 'os';
import { stub, SinonStub } from 'sinon';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures', f);
}

export function stubPlatform(platform: string) {
  stub(os, 'platform').callsFake(() => {
    return platform;
  });
  (os.platform as SinonStub).restore;
}
