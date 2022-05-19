import * as path from 'path';
import { fixtureDir, stubPlatform } from '../common';
import { inspect } from '../../lib';
import * as subProcess from '../../lib/sub-process';

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');
let subProcessExecSpy;
let restorePlatform;

beforeAll(() => {
  restorePlatform = stubPlatform('darwin');
  subProcessExecSpy = jest.spyOn(subProcess, 'execute');
  subProcessExecSpy.mockRejectedValue(new Error('fake process aborted'));
});

afterAll(() => {
  restorePlatform();
});

afterEach(() => {
  jest.clearAllMocks();
});

test('darwin without wrapper invokes gradle directly', async () => {
  await expect(inspect(rootNoWrapper, 'build.gradle')).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe('gradle');
});

test('darwin with wrapper invokes wrapper script', async () => {
  await expect(inspect(rootWithWrapper, 'build.gradle')).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe(
    "'" + path.join(rootWithWrapper, 'gradlew') + "'",
  );
});

test('darwin with wrapper in root invokes wrapper script', async () => {
  await expect(
    inspect(subWithWrapper, path.join('app', 'build.gradle')),
  ).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe(
    "'" + path.join(subWithWrapper, 'gradlew') + "'",
  );
});
