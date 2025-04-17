import * as os from 'os';

/**
 * Quotes the value if the OS is Windows.
 */
export function quoteValueOnWindows(arg: string): string {
  const isWinLocal = /^win/.test(os.platform());
  if (isWinLocal) {
    return `"${arg}"`;
  }

  return arg;
}
