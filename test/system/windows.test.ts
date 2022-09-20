import * as os from 'os';
import * as path from 'path';
import { fixtureDir } from '../common';
import * as subProcess from '../../lib/sub-process';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');
let subProcessExecSpy;
let platformMock;

beforeAll(() => {
  platformMock = jest.spyOn(os, 'platform');
  platformMock.mockReturnValue('win');
  subProcessExecSpy = jest.spyOn(subProcess, 'execute');
  subProcessExecSpy.mockRejectedValue(new Error('fake process aborted'));
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

test('windows with wrapper in root invokes wrapper bat', async () => {
  await expect(
    inspect(subWithWrapper, path.join('app', 'build.gradle')),
  ).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe(
    '"' + path.join(subWithWrapper, 'gradlew.bat') + '"',
  );
});

test('windows with wrapper invokes wrapper bat', async () => {
  await expect(inspect(rootWithWrapper, 'build.gradle')).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe(
    '"' + path.join(rootWithWrapper, 'gradlew.bat') + '"',
  );
});

test('windows without wrapper invokes gradle directly', async () => {
  await expect(inspect(rootNoWrapper, 'build.gradle')).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe('gradle');
});
