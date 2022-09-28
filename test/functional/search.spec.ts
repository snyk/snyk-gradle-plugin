import type { NeedleResponse } from 'needle';

import { getMavenPackageInfo } from '../../lib/search';

describe('should get Maven package info', () => {
  it('returns maven coordinate string when purl string returned', async () => {
    const received = await getMavenPackageInfo(
      'ba55c13d7ac2fd44df9cc8074455719a33f375b9', // log4j-core
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [
            {
              id: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.15.0',
              type: 'package',
            },
          ],
        },
      }),
    );
    expect(received).toBe('org.apache.logging.log4j:log4j-core@2.15.0');
  });

  it("should return 'unknown' values when partial purl string returned", async () => {
    const received = await getMavenPackageInfo(
      'ba55c13d7ac2fd44df9cc8074455719a33f375b9', // log4j-core
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [
            {
              id: 'pkg:maven/log4j-core@2.15.0',
              type: 'package',
            },
          ],
        },
      }),
    );
    expect(received).toBe('unknown:log4j-core@2.15.0');
  });

  it("should return all 'unknown' values when no/non purl string returned", async () => {
    const noPurlStringReceived = await getMavenPackageInfo(
      'ba55c13d7ac2fd44df9cc8074455719a33f375b9', // log4j-core
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          data: [],
        },
      }),
    );
    expect(noPurlStringReceived).toBe('unknown:unknown@unknown');

    const nonPurlStringReceived = await getMavenPackageInfo(
      'ba55c13d7ac2fd44df9cc8074455719a33f375b9', // log4j-core
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
    expect(nonPurlStringReceived).toBe('unknown:unknown@unknown');
  });
});
