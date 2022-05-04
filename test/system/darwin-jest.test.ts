// import * as os from 'os';
// import * as path from 'path';
// import { fixtureDir, stubPlatform, stubSubProcessExec } from '../common';
// import { stub, SinonStub } from 'sinon';
// import * as subProcess from '../../lib/sub-process';
// import { inspect } from '../../lib';

// const rootNoWrapper = fixtureDir('no wrapper');
// const rootWithWrapper = fixtureDir('with-wrapper');
// const subWithWrapper = fixtureDir('with-wrapper-in-root');

// test('darwin without wrapper', async (t) => {
//   stubPlatform('darwin', t);
//   stubSubProcessExec(t);

//   try {
//     const result = await inspect(rootNoWrapper, 'build.gradle');
//     expect(result).rejects.toMatch('Expected failure');
//   } catch {
//     // const cmd = (subProcess.execute as SinonStub).getCall(0).args[0];
//     // t.same(cmd, 'gradle', 'invokes gradle directly');
//   }
// });
