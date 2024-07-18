/// <reference types="node" />
export declare function execute(command: string, args: string[], options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}, perLineCallback?: (s: string) => Promise<void>): Promise<string>;
