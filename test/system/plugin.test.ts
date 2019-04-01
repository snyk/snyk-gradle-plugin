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

test('run inspect()', (t) => {
  t.plan(1);
  return plugin.inspect('.', path.join(rootNoWrapper, 'build.gradle'))
    .then((result) => {
      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
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

test('windows without wrapper', (t) => {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootNoWrapper, 'build.gradle')
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      t.same(cmd, 'gradle', 'invokes gradle directly');
    });
});

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

test('windows with wrapper', (t) => {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(rootWithWrapper, 'build.gradle')
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      const expectedCmd = path.join(rootWithWrapper, 'gradlew.bat');
      t.same(cmd, expectedCmd, 'invokes wrapper bat');
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

test('windows with wrapper in root', (t) => {
  t.plan(1);

  stubPlatform('win32', t);
  stubSubProcessExec(t);

  return plugin.inspect(subWithWrapper, path.join('app', 'build.gradle'))
    .then(t.fail)
    .catch(() => {
      const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
      const expectedCmd = path.join(subWithWrapper, 'gradlew.bat');
      t.same(cmd, expectedCmd, 'invokes wrapper bat');
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

test('multi-project: only sub-project has deps and they are returned', (t) => {
  t.plan(2);
  const options = {
    'gradle-sub-project': 'subproj',
  };
  return plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    options)
    .then((result) => {
      t.match(result.package.name, '/subproj',
        'sub project name is included in the root pkg name');

      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-project: only sub-project has deps and they are returned space needs trimming', (t) => {
  t.plan(2);
  const options = {
    'gradle-sub-project': 'subproj ',
  };
  return plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'),
    options)
    .then((result) => {
      t.match(result.package.name, '/subproj',
        'sub project name is included in the root pkg name');

      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-project: only sub-project has deps, none returned for main', (t) => {
  t.plan(2);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'build.gradle'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package.dependencies);
  })
    .catch(t.threw);
});

test('multi-project: using gradle 3.0.0 via wrapper', (t) => {
  t.plan(2);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-project-gradle-3'), 'build.gradle'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package.dependencies);
  })
    .catch(t.threw);
});

test('multi-confg: both compile and runtime deps picked up by default', (t) => {
  t.plan(4);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.equal(result.package
      .dependencies!['com.android.tools.build:builder']
      .dependencies!['com.android.tools:sdklib']
      .dependencies!['com.android.tools:repository']
      .dependencies!['com.android.tools:common']
      .dependencies!['com.android.tools:annotations'].version,
    '25.3.0',
    'correct version of compile+runtime dep found');
    t.equal(result.package
      .dependencies!['javax.servlet:servlet-api'].version,
    '2.5',
    'correct version of compileOnly dep found');
    t.equal(Object.keys(result.package.dependencies!).length, 6, 'top level deps: 6');
  })
    .catch(t.threw);
});

test('multi-confg: only deps for specified conf are picked up', (t) => {
  t.plan(4);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('multi-config'), 'build.gradle'),
    {args: ['--configuration', 'compileOnly']});
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.notOk(result.package
      .dependencies!['com.android.tools.build:builder'],
    'no compile+runtime dep found');
    t.equal(result.package
      .dependencies!['javax.servlet:servlet-api'].version,
    '2.5',
    'correct version of compileOnly dep found');
    t.equal(Object.keys(result.package.dependencies!).length, 1, 'top level deps: 1');
  })
    .catch(t.threw);
});

// Timeout is 150 seconds because Gradle .kts builds are slower than usual
test('build.gradle.kts files are supported', {timeout: 150000}, (t) => {
  t.plan(3);
  const resultPromise = plugin.inspect('.',
    path.join(fixtureDir('gradle-kts'), 'build.gradle.kts'));
  resultPromise.then((result) => {
    t.match(result.package.name, '.',
      'returned project name is not sub-project');
    t.equal(result.package
      .dependencies!['org.jetbrains.kotlin:kotlin-stdlib-jdk8']
      .dependencies!['org.jetbrains.kotlin:kotlin-stdlib']
      .dependencies!['org.jetbrains.kotlin:kotlin-stdlib-common'].version,
    '1.3.21',
    'correct version of a dependency is found');
    t.equal(Object.keys(result.package.dependencies!).length, 6, 'top level deps: 6');
  })
    .catch(t.threw);
});

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

test('multi-project, explicitly targeting a subproject build file', (t) => {
  t.plan(2);
  return plugin.inspect('.',
    path.join(fixtureDir('multi-project'), 'subproj', 'build.gradle'))
    .then((result) => {
      t.equals(result.package.name, '.',
        'root project is "."');

      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-project, ran from root, targeting subproj', (t) => {
  t.plan(2);
  return plugin.inspect(
    fixtureDir('multi-project'),
    'subproj/build.gradle')
    .then((result) => {
      t.equals(result.package.name, 'multi-project',
        'root project is "multi-project"');

      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
});

test('multi-project, ran from a subproject directory', (t) => {
  t.plan(2);
  return plugin.inspect(
    path.join(fixtureDir('multi-project'), 'subproj'),
    'build.gradle')
    .then((result) => {
      t.equals(result.package.name, 'subproj',
        'root project is "subproj"');

      t.equal(result.package
        .dependencies!['com.android.tools.build:builder']
        .dependencies!['com.android.tools:sdklib']
        .dependencies!['com.android.tools:repository']
        .dependencies!['com.android.tools:common']
        .dependencies!['com.android.tools:annotations'].version,
      '25.3.0',
      'correct version found');
    })
    .catch(t.threw);
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
