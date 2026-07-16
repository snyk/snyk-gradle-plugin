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

export interface PomCoords {
  groupId: string;
  artifactId: string;
  version: string;
  type: string;
  classifier?: string;
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

// TODO(kyegupov): the types below will be extracted to a common plugin interface library
export interface GradleInspectOptions {
  // A regular expression (Java syntax, case-insensitive) to select Gradle configurations.
  // If only one configuration matches, its attributes will be used for dependency resolution;
  // otherwise, an artificial merged configuration will be created (see configuration-attributes
  // below).
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  // This replaces legacy `-- --configuration=foo` argument specification.
  'configuration-matching'?: string;

  // A comma-separated list of key:value pairs, e.g. "buildtype=release,usage=java-runtime".
  // If specified, will scan all configurations for attributes with names that contain "keys" (case-insensitive)
  // and have values that have a string representation that match the specified one, and will copy
  // these attributes into the merged configuration.
  // Attributes are important for dependency resolution in Android builds (see
  // https://developer.android.com/studio/build/dependencies#variant_aware )
  'configuration-attributes'?: string;

  // For some reason, `--no-daemon` is not required for Unix, but on Windows, without this flag, apparently,
  // Gradle process just never exits, from the Node's standpoint.
  // Leaving default usage `--no-daemon`, because of backwards compatibility
  daemon?: boolean;
  initScript?: string;
  gradleNormalizeDeps?: boolean;

  // Emit component-metadata node labels (hash:<alg> and, when the real
  // resolution was observed, distribution:url). Passed to init.gradle as
  // -PsnykIncludeComponentMetadata. Off by default.
  includeComponentMetadata?: boolean;

  // Force `--refresh-dependencies` so metadata reads fire and distribution:url
  // is populated even on a warm cache. Opt-in: forces network access and can
  // re-resolve dynamic/SNAPSHOT versions. No-op under `--offline`. Only affects
  // distribution:url coverage; hash:<alg> labels are unaffected. The same effect
  // is available on the legacy path via `snyk test -- --refresh-dependencies`.
  gradleRefreshDependencies?: boolean;
}

export interface CliOptions {
  'print-graph'?: boolean; // this will need to change as it will affect all gradle sboms
}
