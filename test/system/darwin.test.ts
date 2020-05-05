import * as os from 'os';
import * as path from 'path';
import { fixtureDir } from '../common';
import { test, Test } from 'tap';
import { stub, SinonStub } from 'sinon';
import * as subProcess from '../../lib/sub-process';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');

test('darwin without wrapper', async (t) => {
  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  try {
    await inspect(rootNoWrapper, 'build.gradle');
    t.fail('Expected failure');
  } catch {
    const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
    t.same(cmd, 'gradle', 'invokes gradle directly');
  }
});

test('darwin with wrapper', async (t) => {
  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  try {
    await inspect(rootWithWrapper, 'build.gradle');
    t.fail('Expected failure');
  } catch {
    const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
    const expectedCmd = "'" + path.join(rootWithWrapper, 'gradlew') + "'";
    t.same(cmd, expectedCmd, 'invokes wrapper script');
  }
});

test('darwin with wrapper in root', async (t) => {
  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  try {
    await inspect(subWithWrapper, path.join('app', 'build.gradle'));
    t.fail('Expected failure');
  } catch {
    const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
    const expectedCmd = "'" + path.join(subWithWrapper, 'gradlew') + "'";
    t.same(cmd, expectedCmd, 'invokes wrapper script');
  }
});

function stubPlatform(platform: string, t: Test) {
  stub(os, 'platform').callsFake(() => {
    return platform;
  });
  t.teardown((os.platform as SinonStub).restore);
}

function stubSubProcessExec(t: Test) {
  stub(subProcess, 'execute').callsFake(() => {
    return Promise.reject(new Error('abort'));
  });
  t.teardown((subProcess.execute as SinonStub).restore);
}
