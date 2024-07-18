import type { PomCoords, SnykHttpClient } from './types';
export declare function getMavenPackageInfo(sha1: string, depCoords: Partial<PomCoords>, snykHttpClient: SnykHttpClient): Promise<string>;
