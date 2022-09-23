import type { NeedleResponse } from 'needle';

import { exportsForTests as testableMethods } from '../../lib';

describe('should convert strings to camel case', () => {
  it.each`
    input         | output       | msg
    ${''}         | ${''}        | ${'should work with empty string'}
    ${'ala'}      | ${'ala'}     | ${'should return the string unchanged when lowercase'}
    ${'ALA'}      | ${'ala'}     | ${'should camelcase when all uppercase string'}
    ${'ala bala'} | ${'alaBala'} | ${'should camelcase when having two words'}
    ${'ALA BALA'} | ${'alaBala'} | ${'should camelcase when having two words with uppercase'}
    ${'Ala Bala'} | ${'alaBala'} | ${'should camelcase when having two words with first letter of each word uppercase'}
  `('function toCamelCase $msg', ({ input, output }) => {
    expect(testableMethods.toCamelCase(input)).toBe(output);
  });
});

describe('should split coordinate strings', () => {
  it.each`
    input                                       | output                                                                            | msg
    ${''}                                       | ${{}}                                                                             | ${'should return empty obj for empty string'}
    ${'a.group.id'}                             | ${{}}                                                                             | ${'should return empty object when only one value'}
    ${'a.group.id:artifact-id'}                 | ${{}}                                                                             | ${'should return empty object for string when only two colon separated values'}
    ${'a.group.id@release-1.0.0'}               | ${{}}                                                                             | ${'should return empty object for string when only two @ separated values'}
    ${'a.group.id:artifact-id:release-1.0.0'}   | ${{}}                                                                             | ${'should return empty object for string when three colon separated values'}
    ${'a.group.id:artifact-id@release-1.0.0:d'} | ${{}}                                                                             | ${'should return empty object for string with more than three colon or @ separated values'}
    ${'a.group.id:artifact-id@release-1.0.0'}   | ${{ groupId: 'a.group.id', artifactId: 'artifact-id', version: 'release-1.0.0' }} | ${'should return object with correct properties for string with groupId, artifactId and @version'}
  `('function splitCoordinate $msg', ({ input, output }) => {
    expect(testableMethods.splitCoordinate(input)).toEqual(output);
  });
});

describe('should get Maven package info', () => {
  it('returns maven coordinate string when ok:true response with coordinate property', async () => {
    const received = await testableMethods.getMavenPackageInfo(
      'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          ok: true,
          code: 200,
          coordinate: {
            groupId: 'group1',
            artifactId: 'artifact1',
            version: 'version1',
          },
        },
      }),
    );
    expect(received).toBe('group1:artifact1@version1');
  });

  it("should return all 'unknown' values when no dep coordinates passed, 200, ok:true and NO coordinate property on response", async () => {
    const received = await testableMethods.getMavenPackageInfo(
      'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
      {},
      async () => ({
        res: {} as NeedleResponse,
        body: {
          ok: true,
          code: 200,
        },
      }),
    );
    expect(received).toBe('unknown:unknown@unknown');
  });

  it('should return passed dep coordinate value when 200, ok:true and partial coordinate property on response', async () => {
    const received = await testableMethods.getMavenPackageInfo(
      'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
      {
        groupId: 'group',
        artifactId: 'artifact',
        version: '2',
      },
      async () => ({
        res: {} as NeedleResponse,
        body: {
          ok: true,
          code: 200,
          coordinate: {
            groupId: 'group2',
            artifactId: 'artifact',
          },
        },
      }),
    );
    expect(received).toBe('group2:artifact@2');
  });
});
