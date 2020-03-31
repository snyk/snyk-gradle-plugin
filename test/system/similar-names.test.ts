/* tslint:disable:no-console */
import * as os from 'os';
import * as path from 'path';
import {fixtureDir} from '../common';
import {test, Test} from 'tap';
import {stub, SinonStub} from 'sinon';
import * as subProcess from '../../lib/sub-process';
import {inspect} from '../../lib';

const projectRoot = fixtureDir('multi-project-similar-names');
test('my test', async (t) => {
  const result = await inspect(projectRoot, 'build.gradle');
  // console.log(JSON.stringify({ result }, null, 4));
  console.log(result!.plugin!.meta!.allSubProjectNames);
  t.equal(result!.plugin!.meta!.allSubProjectNames as any, 2, 'success');
});
