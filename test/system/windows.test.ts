import * as os from 'os';
import * as path from 'path';
import { fixtureDir } from '../common';
import * as subProcess from '../../lib/sub-process';
import { inspect } from '../../lib';

jest.mock('os', () => {
  const actual = jest.requireActual<typeof import('os')>('os');
  return {
    ...actual,
    platform: jest.fn(() => 'win32' as NodeJS.Platform),
  };
});

const rootNoWrapper = fixtureDir('no wrapper');
const rootWithWrapper = fixtureDir('with-wrapper');
const subWithWrapper = fixtureDir('with-wrapper-in-root');
let subProcessExecSpy: jest.SpiedFunction<typeof subProcess.execute>;
/** Use the real host so Windows-only assertions stay gated to Windows machines. */
const isWinLocal = /^win/.test(process.platform);

beforeAll(() => {
  (os.platform as jest.MockedFunction<() => NodeJS.Platform>).mockReturnValue(
    'win32',
  );
  subProcessExecSpy = jest.spyOn(subProcess, 'execute');
  subProcessExecSpy.mockRejectedValue(new Error('fake process aborted'));
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
if (isWinLocal) {
  test('windows with wrapper in root invokes wrapper bat', async () => {
    await expect(
      inspect(subWithWrapper, path.join('app', 'build.gradle')),
    ).rejects.toThrow();
    expect(subProcessExecSpy.mock.calls[0]).toEqual([
      `${subWithWrapper}\\gradlew.bat`,
      ['-v'],
      {
        cwd: `${subWithWrapper}`,
      },
    ]);
  });

  test('windows with wrapper invokes wrapper bat', async () => {
    await expect(inspect(rootWithWrapper, 'build.gradle')).rejects.toThrow();
    expect(subProcessExecSpy.mock.calls[0]).toEqual([
      `${rootWithWrapper}\\gradlew.bat`,
      ['-v'],
      {
        cwd: `${rootWithWrapper}`,
      },
    ]);
  });
}
test('windows without wrapper invokes gradle directly', async () => {
  await expect(inspect(rootNoWrapper, 'build.gradle')).rejects.toThrow();
  expect(subProcessExecSpy.mock.calls[0][0]).toBe('gradle');
});
