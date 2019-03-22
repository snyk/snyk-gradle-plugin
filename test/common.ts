import * as path from 'path';
import * as os from 'os';
import {stub, SinonStub} from 'sinon';
import * as subProcess from '../lib/sub-process';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./dist/test
  return path.join(__dirname, './fixtures', f);
}

export function stubPlatform(platform, t) {
  stub(os, 'platform')
    .callsFake(() => {
      return platform;
    });
  t.teardown((os.platform as SinonStub).restore);
}

export function stubSubProcessExec(t) {
  stub(subProcess, 'execute')
    .callsFake(() => {
      return Promise.reject(new Error('abort'));
    });
  t.teardown((subProcess.execute as SinonStub).restore);
}
