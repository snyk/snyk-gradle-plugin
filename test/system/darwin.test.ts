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

test('darwin without wrapper', async () => {
  try {
    await inspect(rootNoWrapper, 'build.gradle');
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe('gradle');
  }
});

test('darwin with wrapper', async () => {
  try {
    await inspect(rootWithWrapper, 'build.gradle');
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe(
      "'" + path.join(rootWithWrapper, 'gradlew') + "'",
    );
  }
});

test('darwin with wrapper in root', async () => {
  try {
    await inspect(subWithWrapper, path.join('app', 'build.gradle'));
  } catch {
    expect(subProcessExecSpy.mock.calls[0][0]).toBe(
      "'" + path.join(subWithWrapper, 'gradlew') + "'",
    );
  }
});
