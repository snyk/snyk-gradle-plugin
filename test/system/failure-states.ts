import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import * as plugin from '../../lib';
import {stub, SinonStub} from 'sinon';
import * as subProcess from '../../lib/sub-process';

const rootNoWrapper = fixtureDir('no wrapper');

test('malformed build.gradle', (t) => {
  t.plan(1);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('malformed-build-gradle'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  resultPromise.then(function success(result) {
    t.fail('expected inspect to fail');
  }, function failure(err) {
    t.match(err.toString(), /unexpected token/, 'error thrown as expected');
  });
});

test('failing inspect()', (t) => {
  t.plan(1);
  stubSubProcessExec(t);
  return plugin.inspect('.', path.join(rootNoWrapper, 'build.gradle'))
    .then((result) => {
      t.fail('Should have thrown!', result);
    })
    .catch((error) => {
      t.match(error.message, 'executes successfully on this project',
        'proper error message');
    });
});

function stubSubProcessExec(t) {
  stub(subProcess, 'execute')
    .callsFake(() => {
      return Promise.reject(new Error('abort'));
    });
  t.teardown((subProcess.execute as SinonStub).restore);
}
