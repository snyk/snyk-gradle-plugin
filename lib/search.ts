import type { GetPackageData, PomCoords, SnykHttpClient } from './types';
import { PackageURL } from 'packageurl-js';
import { debugLog } from '.';
import { coordsToString } from './coordinate';

const PACKAGE_SEARCH_TYPE = 'maven';
const PACKAGE_SEARCH_VERSION = '2022-09-21~beta';

export async function getMavenPackageInfo(
  sha1: string,
  depCoords: Partial<PomCoords>,
  snykHttpClient: SnykHttpClient,
): Promise<string> {
  const { res, body } = await snykHttpClient({
    method: 'get',
    // base URL defaults to SNYK_API_REST_URL="https://api.snyk.io/rest"
    path: `/packages`,
    qs: {
      version: PACKAGE_SEARCH_VERSION,
      /* eslint-disable @typescript-eslint/camelcase */
      package_type: PACKAGE_SEARCH_TYPE,
      package_sha1: sha1,
      package_namespace: depCoords.groupId,
      package_name: depCoords.artifactId,
      package_version: depCoords.version,
      /* eslint-enable @typescript-eslint/camelcase */
    },
  });

  if (res?.statusCode >= 400 || !body) {
    debugLog(
      `Failed to resolve ${JSON.stringify(depCoords)} using sha1 '${sha1}.`,
    );
    // use input coordinates if sha1 cannot be resolved for whatever reason
    return coordsToString(depCoords);
  }

  try {
    const purlString = (body as GetPackageData)?.data[0]?.id;
    const pkg = PackageURL.fromString(purlString);
    const { namespace, name, version } = pkg;
    depCoords.groupId = namespace;
    depCoords.artifactId = name;
    depCoords.version = version;
  } catch (_error) {
    debugLog(
      `Failed to parse purl components for ${JSON.stringify(
        depCoords,
      )} using sha1 '${sha1}.`,
    );
  }
  return coordsToString(depCoords);
}
