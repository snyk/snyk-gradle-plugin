import * as path from 'path';
import { fixtureDir, stubPlatform } from '../common';
import * as subProcess from '../../lib/sub-process';
import { inspect } from '../../lib';

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');
let subProcessExecSpy;

beforeAll(() => {
  stubPlatform('win32');
  subProcessExecSpy = jest.spyOn(subProcess, 'execute');
  subProcessExecSpy.mockRejectedValue(new Error('fake process aborted'));
});

afterEach(() => {
  jest.clearAllMocks();
});

test('windows with wrapper in root', async () => {
  try {
    await inspect(subWithWrapper, path.join('app', 'build.gradle'));
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe(
      '"' + path.join(subWithWrapper, 'gradlew.bat') + '"',
    );
  }
});

test('windows with wrapper', async () => {
  try {
    await inspect(rootWithWrapper, 'build.gradle');
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe(
      '"' + path.join(rootWithWrapper, 'gradlew.bat') + '"',
    );
  }
});

test('windows without wrapper', async () => {
  try {
    await inspect(rootNoWrapper, 'build.gradle');
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe('gradle');
  }
});
