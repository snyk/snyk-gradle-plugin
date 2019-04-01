import * as childProcess from 'child_process';

export function execute(command: string, args: string[], options: {cwd?: string}): Promise<string> {
  const spawnOptions: childProcess.SpawnOptions = {shell: true};
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data) => {
      stdout = stdout + data;
    });
    proc.stderr.on('data', (data) => {
      stderr = stderr + data;
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const fullCommand = command + ' ' + args.join(' ');
        return reject(new Error(`
>>> command: ${fullCommand}
>>> exit code: ${code}
>>> stdout:
${stdout}
>>> stderr:
${stderr}
`));
      }
      resolve(stdout || stderr);
    });
  });
}
