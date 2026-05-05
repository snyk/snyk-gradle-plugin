import * as childProcess from 'child_process';
import { escapeAll } from 'shescape/stateless';
import * as os from 'os';
import debugModule = require('debug');

const debugLogging = debugModule('snyk-gradle-plugin');

/** `child_process` options plus shescape-only fields read by `escapeAll` / `quoteAll` (not used by `spawn`). */
type SpawnOptionsWithShescape = childProcess.SpawnOptions & {
  /** When false, shescape must not strip leading `-` from argv (Gradle needs `-q`, `--project-dir`, etc.). */
  flagProtection: boolean;
};

// Executes a subprocess. Resolves successfully with stdout contents if the exit code is 0.
export function execute(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  perLineCallback?: (s: string) => Promise<void>,
): Promise<string> {
  const spawnOptions: SpawnOptionsWithShescape = {
    shell: false,
    env: { ...process.env },
    flagProtection: false,
  };
  if (options?.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  if (options?.env) {
    spawnOptions.env = { ...process.env, ...options.env };
  }

  args = escapeAll(args, spawnOptions);

  if (/^win/.test(os.platform())) {
    spawnOptions.windowsVerbatimArguments = true; // makes windows process " correctly

    const updated = updateCommandAndArgsForWindows(command, args);
    command = updated.command;
    args = updated.args;
  }
  // Before spawning an external process, we look if we need to restore the system proxy configuration,
  // which overides the cli internal proxy configuration.
  if (process.env.SNYK_SYSTEM_HTTP_PROXY !== undefined) {
    spawnOptions.env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
  }
  if (process.env.SNYK_SYSTEM_HTTPS_PROXY !== undefined) {
    spawnOptions.env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
  }
  if (process.env.SNYK_SYSTEM_NO_PROXY !== undefined) {
    spawnOptions.env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data: Buffer) => {
      const strData = data.toString();
      stdout = stdout + strData;
      if (perLineCallback) {
        strData.split('\n').forEach(perLineCallback);
      }
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr = stderr + data;
    });

    proc.on('error', (error) => {
      stderr = stderr + error;
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        const fullCommand = command + ' ' + args.join(' ');
        return reject(
          new Error(`
>>> command: ${fullCommand}
>>> exit code: ${code}
>>> stdout:
${stdout}
>>> stderr:
${stderr}
`),
        );
      }
      if (stderr) {
        debugLogging(
          'subprocess exit code = 0, but stderr was not empty: ' + stderr,
        );
      }

      resolve(stdout);
    });
  });
}

/**
 * Wraps an argument in double quotes for cmd.exe. Inside double quotes,
 * cmd.exe treats ^, $, &, <, >, | as literal characters. Only internal
 * double quotes need escaping (doubled). This matches the quoting behaviour
 * of shescape 1.x and avoids shescape 2.x's "break-out-of-quotes" technique
 * which corrupts regex metacharacters like ^ when passed through cmd.exe /c.
 */
function quoteForCmd(arg: string): string {
  return `"${arg.replace(/"/g, '""')}"`;
}

function updateCommandAndArgsForWindows(
  command: string,
  args: string[],
): { command: string; args: string[] } {
  args = args.map(quoteForCmd);

  if (command !== 'gradle') {
    args = [`"${command}"`, ...args];
    args = ['/c', `"${args.join(' ')}"`];
  } else {
    args = ['/c', command, ...args];
  }

  return { command: 'cmd.exe', args };
}
