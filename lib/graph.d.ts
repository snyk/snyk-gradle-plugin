import type { CoordinateMap } from './types';
export interface GradleGraph {
    [id: string]: {
        name: string;
        version: string;
        parentIds: string[];
    };
}
interface QueueItem {
    id: string;
    parentId: string;
}
export declare function buildGraph(gradleGraph: GradleGraph, rootPkgName: string, projectVersion: string, coordinateMap?: CoordinateMap): Promise<import("@snyk/dep-graph").DepGraph>;
export declare function findChildren(parentId: string, gradleGraph: GradleGraph): QueueItem[];
export {};
