var os = require('os');
var path = require('path');
var test = require('tap').test;
var sinon = require('sinon');
var plugin = require('../../lib');
var subProcess = require('../../lib/sub-process');

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
    .catch(t.fail);
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
      var cmd = subProcess.execute.getCall(0).args[0];
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
      var cmd = subProcess.execute.getCall(0).args[0];
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
      var cmd = subProcess.execute.getCall(0).args[0];
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
      var cmd = subProcess.execute.getCall(0).args[0];
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
      var cmd = subProcess.execute.getCall(0).args[0];
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
      var cmd = subProcess.execute.getCall(0).args[0];
      var expectedCmd = path.join(
        __dirname, '..', 'fixtures', 'with-wrapper-in-root', 'gradlew');
      t.same(cmd, expectedCmd, 'invokes wrapper script');
    });
});

test('only sub-project has deps', function (t) {
  t.plan(2);
  const options = {
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
    .catch(t.fail);
});

function stubPlatform(platform, t) {
  sinon.stub(os, 'platform')
    .callsFake(function () {
      return platform;
    });
  t.teardown(os.platform.restore);
}

function stubSubProcessExec(t) {
  sinon.stub(subProcess, 'execute')
    .callsFake(function () {
      return Promise.reject(new Error('abort'));
    });
  t.teardown(subProcess.execute.restore);
}
