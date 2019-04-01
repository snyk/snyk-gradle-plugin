
import * as path from 'path';
import {fixtureDir} from '../common';
import {test} from 'tap';
import * as plugin from '../../lib';

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
