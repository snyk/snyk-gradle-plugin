import { DepGraph } from '@snyk/dep-graph';
import { legacyPlugin as api } from '@snyk/cli-interface';
import { getGradleAttributesPretty } from './gradle-attributes-pretty';
import { GradleGraph } from './graph';
import type { CoordinateMap, PomCoords, Sha1Map, SnykHttpClient } from './types';
export declare function debugLog(s: string): void;
export interface GradleInspectOptions {
    'configuration-matching'?: string;
    'configuration-attributes'?: string;
    daemon?: boolean;
    initScript?: string;
    gradleNormalizeDeps?: boolean;
}
type Options = api.InspectOptions & GradleInspectOptions;
type VersionBuildInfo = api.VersionBuildInfo;
export declare function inspect(root: string, targetFile: string, options?: api.SingleSubprojectInspectOptions & GradleInspectOptions, snykHttpClient?: SnykHttpClient): Promise<api.SinglePackageResult>;
export declare function inspect(root: string, targetFile: string, options: api.MultiSubprojectInspectOptions & GradleInspectOptions, snykHttpClient?: SnykHttpClient): Promise<api.MultiProjectResult>;
export interface JsonDepsScriptResult {
    defaultProject: string;
    defaultProjectKey: string;
    projects: ProjectsDict;
    allSubProjectNames: string[];
    versionBuildInfo?: VersionBuildInfo;
    sha1Map?: Sha1Map;
}
interface ProjectsDict {
    [project: string]: GradleProjectInfo;
}
interface GradleProjectInfo {
    depGraph?: DepGraph;
    gradleGraph?: GradleGraph;
    targetFile: string;
    projectVersion: string;
}
declare function extractJsonFromScriptOutput(stdoutText: string): JsonDepsScriptResult;
declare function getVersionBuildInfo(gradleVersionOutput: string): VersionBuildInfo | undefined;
declare function splitCoordinate(coordinate: string): Partial<PomCoords>;
export declare function processProjectsInExtractedJSON(extractedJSON: JsonDepsScriptResult, coordinateMap?: CoordinateMap, configurationMatching?: boolean): Promise<JsonDepsScriptResult>;
declare function toCamelCase(input: string): string;
declare function buildArgs(root: string, targetFile: string | null, initGradlePath: string, options: Options, gradleVersion: string): string[];
export declare const exportsForTests: {
    buildArgs: typeof buildArgs;
    extractJsonFromScriptOutput: typeof extractJsonFromScriptOutput;
    getVersionBuildInfo: typeof getVersionBuildInfo;
    toCamelCase: typeof toCamelCase;
    getGradleAttributesPretty: typeof getGradleAttributesPretty;
    splitCoordinate: typeof splitCoordinate;
};
export {};
