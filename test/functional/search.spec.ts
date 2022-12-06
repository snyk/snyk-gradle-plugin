import type { NeedleResponse } from 'needle';

import { getMavenPackageInfo } from '../../lib/search';

describe('should get Maven package info', () => {
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
    expect(received).toBe('org.apache.logging.log4j:log4j-core@2.15.0');
  });

  it("should return 'unknown' values when partial purl string returned", async () => {
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
    expect(received).toBe('unknown:log4j-core@2.15.0');
  });

  it("should return 'unknown' values with unique artifact id when no/non purl string returned", async () => {
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
    expect(noPurlStringReceived).toBe(`unknown:artifactId1-${sha1}@unknown`);

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
    expect(nonPurlStringReceived).toBe(`unknown:artifactId1-${sha1}@unknown`);

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
    expect(nonPurlStringReceived2).toBe(`unknown:${sha1}@unknown`);
  });

  it("should return 'unknown' values with unique artifact id for separate packages when all have partial/no/non purl string returned", async () => {
    const received1 = await getMavenPackageInfo(sha1, {}, async () => ({
      res: {} as NeedleResponse,
      body: {
        data: [
          {
            id: 'corruptedId1',
            type: 'package',
          },
        ],
      },
    }));

    const secondSha1 = 'ca55c13d7ac2fd44df9cc8074455719a33f375b9';
    const received2 = await getMavenPackageInfo(secondSha1, {}, async () => ({
      res: {} as NeedleResponse,
      body: {
        data: [
          {
            id: 'corruptedId2',
            type: 'package',
          },
        ],
      },
    }));

    const thirdSha1 = 'da55c13d7ac2fd44df9cc8074455719a33f375b9';
    const received3 = await getMavenPackageInfo(thirdSha1, {}, async () => ({
      res: {} as NeedleResponse,
      body: {
        data: [
          {
            id: 'corruptedId3',
            type: 'package',
          },
        ],
      },
    }));

    const coordStringArr = [received1, received2, received3];
    // check there are unique coord strings
    expect(new Set(coordStringArr).size).toBe(coordStringArr.length);
  });
});
