import * as os from 'os';
import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import {stub, SinonStub} from 'sinon';
import * as plugin from '../../lib';
import * as subProcess from '../../lib/sub-process';

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');

test('darwin without wrapper', (t) => {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootNoWrapper, 'build.gradle')
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      t.same(cmd, 'gradle', 'invokes gradle directly');
    });
});

test('darwin with wrapper', (t) => {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootWithWrapper, 'build.gradle')
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      const expectedCmd = path.join(rootWithWrapper, 'gradlew');
      t.same(cmd, expectedCmd, 'invokes wrapper script');
    });
});

test('darwin with wrapper in root', (t) => {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(subWithWrapper, path.join('app', 'build.gradle'))
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      const expectedCmd = path.join(subWithWrapper, 'gradlew');
      t.same(cmd, expectedCmd, 'invokes wrapper script');
    });
});

function stubPlatform(platform, t) {
  stub(os, 'platform')
    .callsFake(() => {
      return platform;
    });
  t.teardown((os.platform as SinonStub).restore);
}

function stubSubProcessExec(t) {
  stub(subProcess, 'execute')
    .callsFake(() => {
      return Promise.reject(new Error('abort'));
    });
  t.teardown((subProcess.execute as SinonStub).restore);
}
