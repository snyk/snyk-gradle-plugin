import * as childProcess from 'child_process';
import debugModule = require('debug');

const debugLogging = debugModule('snyk-gradle-plugin');

// Executes a subprocess. Resolves successfully with stdout contents if the exit code is 0.
export function execute(
  command: string,
  args: string[],
  options: { cwd?: string },
  perLineCallback?: (s: string) => Promise<void>,
): Promise<string> {
  const spawnOptions: childProcess.SpawnOptions = { shell: true };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
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
