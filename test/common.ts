import * as path from 'path';
import * as os from 'os';
import {stub, SinonStub} from 'sinon';
import * as subProcess from '../lib/sub-process';
import {Test} from 'tap';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures', f);
}

export function stubPlatform(platform: string, t: Test) {
  stub(os, 'platform')
    .callsFake(() => {
      return platform;
    });
  t.teardown((os.platform as SinonStub).restore);
}

export function stubSubProcessExec(t: Test) {
  stub(subProcess, 'execute')
    .callsFake(() => {
      return Promise.reject(new Error('fake process aborted'));
    });
  t.teardown((subProcess.execute as SinonStub).restore);
}
