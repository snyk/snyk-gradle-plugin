import type { OutgoingHttpHeaders } from 'http';
import type { NeedleHttpVerbs, NeedleResponse } from 'needle';

export interface RequestInfo {
  method: NeedleHttpVerbs;
  path: string;
  body?: any;
  headers?: OutgoingHttpHeaders;
  qs?: {};
  json?: boolean;
  timeout?: number;
  family?: number;
}

export type SnykHttpClient = (requestInfo: RequestInfo) => Promise<{
  res: NeedleResponse;
  body: any;
}>;

export interface Sha1Map {
  [hash: string]: string;
}

export interface CoordinateMap {
  [originalCoordinate: string]: string;
}

export interface PomCoords {
  groupId: string;
  artifactId: string;
  version: string;
}

interface PackageResource {
  id: string;
  type: 'package';
}

type GetPackageResponseData = Array<PackageResource>;

interface GetPackageLinks {
  self?:
    | string
    | {
        href: string;
        meta?: {
          [key: string]: any;
        };
      };
}

export interface GetPackageData {
  data: GetPackageResponseData;
  links: GetPackageLinks;
}
