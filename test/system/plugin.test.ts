import * as os from 'os';
import * as path from 'path';
import {test} from 'tap';
import {stub, SinonStub} from 'sinon';
import * as plugin from '../../lib';
import * as subProcess from '../../lib/sub-process';

var rootNoWrapper = path.join(
  __dirname, '..', 'fixtures', 'no wrapper');

var rootWithWrapper = path.join(
  __dirname, '..', 'fixtures', 'with-wrapper');

var subWithWrapper = path.join(
  __dirname, '..', 'fixtures', 'with-wrapper-in-root');

test('run inspect()', function (t) {
  t.plan(1);
  return plugin.inspect('.', path.join(
    __dirname, '..', 'fixtures', 'no wrapper', 'build.gradle'))
    .then(function (result) {
      t.equal(result.package
        .dependencies['com.android.tools.build:builder']
        .dependencies['com.android.tools:sdklib']
        .dependencies['com.android.tools:repository']
        .dependencies['com.android.tools:common']
        .dependencies['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('failing inspect()', function (t) {
  t.plan(1);
  stubSubProcessExec(t);
  return plugin.inspect('.', path.join(
    __dirname, '..', 'fixtures', 'no wrapper', 'build.gradle'))
    .then(function (result) {
      t.fail('Should have thrown!', result);
    })
    .catch(function (error) {
      t.match(error.message, 'executes successfully on this project',
        'proper error message');
    });
});

test('windows without wrapper', function (t) {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootNoWrapper, 'build.gradle')
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      t.same(cmd, 'gradle', 'invokes gradle directly');
    });
});

test('darwin without wrapper', function (t) {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootNoWrapper, 'build.gradle')
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      t.same(cmd, 'gradle', 'invokes gradle directly');
    });
});

test('windows with wrapper', function (t) {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootWithWrapper, 'build.gradle')
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      var expectedCmd = path.join(
        __dirname, '..', 'fixtures', 'with-wrapper', 'gradlew.bat');
      t.same(cmd, expectedCmd, 'invokes wrapper bat');
    });
});

test('darwin with wrapper', function (t) {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootWithWrapper, 'build.gradle')
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      var expectedCmd = path.join(
        __dirname, '..', 'fixtures', 'with-wrapper', 'gradlew');
      t.same(cmd, expectedCmd, 'invokes wrapper script');
    });
});

test('windows with wrapper in root', function (t) {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(subWithWrapper, path.join('app', 'build.gradle'))
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      var expectedCmd = path.join(
        __dirname, '..', 'fixtures', 'with-wrapper-in-root', 'gradlew.bat');
      t.same(cmd, expectedCmd, 'invokes wrapper bat');
    });
});

test('darwin with wrapper in root', function (t) {
  t.plan(1);

  stubPlatform('darwin', t);
  stubSubProcessExec(t);

  return plugin.inspect(subWithWrapper, path.join('app', 'build.gradle'))
    .then(t.fail)
    .catch(function () {
      var cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      var expectedCmd = path.join(
        __dirname, '..', 'fixtures', 'with-wrapper-in-root', 'gradlew');
      t.same(cmd, expectedCmd, 'invokes wrapper script');
    });
});

test('multi-project: only sub-project has deps and they are returned', function (t) {
  t.plan(2);
  var options = {
    'gradle-sub-project': 'subproj',
  };
  return plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'multi-project', 'build.gradle'),
    options)
    .then(function (result) {
      t.match(result.package.name, '/subproj',
        'sub project name is included in the root pkg name');

      t.equal(result.package
        .dependencies['com.android.tools.build:builder']
        .dependencies['com.android.tools:sdklib']
        .dependencies['com.android.tools:repository']
        .dependencies['com.android.tools:common']
        .dependencies['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-project: only sub-project has deps, none returned for main', function (t) {
  t.plan(2);
  var resultPromise = plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'multi-project', 'build.gradle'));
  resultPromise.then(function (result) {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package.dependencies);
  })
    .catch(t.threw);
});

test('multi-confg: both compile and runtime deps picked up by default', function (t) {
  t.plan(4);
  var resultPromise = plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'multi-config', 'build.gradle'));
  resultPromise.then(function (result) {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.equal(result.package
      .dependencies['com.android.tools.build:builder']
      .dependencies['com.android.tools:sdklib']
      .dependencies['com.android.tools:repository']
      .dependencies['com.android.tools:common']
      .dependencies['com.android.tools:annotations'].version,
    '25.3.0',
    'correct version of compile+runtime dep found');
    t.equal(result.package
      .dependencies['javax.servlet:servlet-api'].version,
    '2.5',
    'correct version of compileOnly dep found');
    t.equal(Object.keys(result.package.dependencies).length, 6, 'top level deps: 6');
  })
    .catch(t.threw);
});

test('multi-confg: only deps for specified conf are picked up', function (t) {
  t.plan(4);
  var resultPromise = plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'multi-config', 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  resultPromise.then(function (result) {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package
      .dependencies['com.android.tools.build:builder'],
    'no compile+runtime dep found');
    t.equal(result.package
      .dependencies['javax.servlet:servlet-api'].version,
    '2.5',
    'correct version of compileOnly dep found');
    t.equal(Object.keys(result.package.dependencies).length, 1, 'top level deps: 1');
  })
    .catch(t.threw);
});

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
test('build.gradle.kts files are supported', {timeout: 150000}, function (t) {
  t.plan(3);
  var resultPromise = plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'gradle-kts', 'build.gradle.kts'));
  resultPromise.then(function (result) {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.equal(result.package
      .dependencies['org.jetbrains.kotlin:kotlin-stdlib-jdk8']
      .dependencies['org.jetbrains.kotlin:kotlin-stdlib']
      .dependencies['org.jetbrains.kotlin:kotlin-stdlib-common'].version,
    '1.3.21',
    'correct version of a dependency is found');
    t.equal(Object.keys(result.package.dependencies).length, 6, 'top level deps: 6');
  })
    .catch(t.threw);
});

test('malformed build.gradle', function (t) {
  t.plan(1);
  var resultPromise = plugin.inspect('.',
    path.join(__dirname, '..', 'fixtures', 'malformed-build-gradle', 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  resultPromise.then(function success(result) {
    console.log(result);
    t.fail('expected inspect to fail');
  }, function failure(err) {
    t.match(err.toString(), /unexpected token/, 'error thrown as expected');
  });
});

function stubPlatform(platform, t) {
  stub(os, 'platform')
    .callsFake(function () {
      return platform;
    });
  t.teardown((os.platform as SinonStub).restore);
}

function stubSubProcessExec(t) {
  stub(subProcess, 'execute')
    .callsFake(function () {
      return Promise.reject(new Error('abort'));
    });
  t.teardown((subProcess.execute as SinonStub).restore);
}
