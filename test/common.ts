import * as path from 'path';
import * as os from 'os';
import { stub, SinonStub } from 'sinon';
import * as subProcess from '../lib/sub-process';
import { Test } from 'tap';
import { legacyCommon, legacyPlugin as api } from '@snyk/cli-interface';

export function fixtureDir(f: string): string {
  // Assuming current directory is ./test
  return path.join(__dirname, 'fixtures', f);
}

export function stubPlatform(platform: string, t: Test) {
  stub(os, 'platform').callsFake(() => {
    return platform;
  });
  t.teardown((os.platform as SinonStub).restore);
}

export function stubSubProcessExec(t: Test) {
  stub(subProcess, 'execute').callsFake(() => {
    return Promise.reject(new Error('fake process aborted'));
  });
  t.teardown((subProcess.execute as SinonStub).restore);
}

export function findDepGraphNodeIds(result: api.SinglePackageResult) {
  const pkgs = result.dependencyGraph.getDepPkgs();
  const nodeIds: string[] = [];
  Object.keys(pkgs).forEach((id) => {
    nodeIds.push(`${pkgs[id].name}@${pkgs[id].version}`);
  });
  return nodeIds;
}
