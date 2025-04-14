import type { NeedleResponse } from 'needle';

import { getMavenPackageInfo } from '../../lib/search';

describe('getMavenPackageInfo', () => {
  const sha1 = 'ba55c13d7ac2fd44df9cc8074455719a33f375b9'; // log4j-core
  it('returns maven coordinate string when purl string returned', async () => {
    const received = await getMavenPackageInfo(sha1, {}, async () => ({
      res: {} as NeedleResponse,
      body: {
        data: [
          {
            id: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.15.0',
            type: 'package',
          },
        ],
      },
    }));
    expect(received).toBe('org.apache.logging.log4j:log4j-core:jar@2.15.0');
  });

  it('returns input coordinate string when 404 returned', async () => {
    const received = await getMavenPackageInfo(
      sha1,
      {
        groupId: 'com.example',
        artifactId: 'artifact',
        version: '1.2.3',
      },
      async () => ({
        res: { statusCode: 404 } as NeedleResponse,
        body: undefined,
      }),
    );
    expect(received).toBe('com.example:artifact:jar@1.2.3');
  });

  it("returns 'unknown' values when partial purl string returned", async () => {
    const received = await getMavenPackageInfo(sha1, {}, async () => ({
      res: {} as NeedleResponse,
      body: {
        data: [
          {
            id: 'pkg:maven/log4j-core@2.15.0',
            type: 'package',
          },
        ],
      },
    }));
    expect(received).toBe('unknown:log4j-core:jar@2.15.0');
  });

  it("returns 'unknown' values with unique artifact id when no/non purl string returned", async () => {
    const noPurlStringReceived = await getMavenPackageInfo(
      sha1,
      { artifactId: 'artifactId1' },
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [],
        },
      }),
    );
    expect(noPurlStringReceived).toBe(`unknown:artifactId1:jar@unknown`);

    const nonPurlStringReceived = await getMavenPackageInfo(
      sha1,
      { artifactId: 'artifactId1' },
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [
            {
              id: 'corruptedId',
              type: 'package',
            },
          ],
        },
      }),
    );
    expect(nonPurlStringReceived).toBe(`unknown:artifactId1:jar@unknown`);

    const nonPurlStringReceived2 = await getMavenPackageInfo(
      sha1,
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [
            {
              id: 'corruptedId',
              type: 'package',
            },
          ],
        },
      }),
    );
    expect(nonPurlStringReceived2).toBe(`unknown:unknown:jar@unknown`);
  });
});
