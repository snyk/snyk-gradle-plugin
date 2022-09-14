import nock from 'nock';

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
    input                                             | output                                                                  | msg
    ${''}                                             | ${{}}                                                                   | ${'should return empty obj for empty string'}
    ${'groupId'}                                      | ${{ groupId: 'groupId' }}                                               | ${'should return only groupId property for string with just groupId'}
    ${'groupId:artifactId'}                           | ${{ groupId: 'groupId', artifactId: 'artifactId' }}                     | ${'should return groupId and artifactId for string with just groupId and artifactId'}
    ${'groupId:artifactId:version'}                   | ${{ groupId: 'groupId', artifactId: 'artifactId', version: 'version' }} | ${'should return object with correct properties for string with groupId, artifactId and version'}
    ${'groupId:artifactId:packaging:version'}         | ${{ groupId: 'groupId', artifactId: 'artifactId', version: 'version' }} | ${'should return object with correct properties for string with groupId, artifactId, packaging and version'}
    ${'groupId:artifactId:packaging:version:compile'} | ${{ groupId: 'groupId', artifactId: 'artifactId', version: 'version' }} | ${'should return object with correct properties for string with groupId, artifactId, packaging, version and compile'}
  `('function splitCoordinate $msg', ({ input, output }) => {
    expect(testableMethods.splitCoordinate(input)).toEqual(output);
  });
});

describe('should get Maven package info', () => {
  afterAll(() => {
    nock.restore(); // see: https://github.com/nock/nock#memory-issues-with-jest
  });

  afterEach(() => {
    expect(nock.pendingMocks()).toHaveLength(0);
    nock.cleanAll();
  });

  it('returns Maven package info', async () => {
    nock('https://api.dev.snyk.io')
      .get(
        '/rest/maven/coordinates/sha1/c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2?',
      )
      .reply(200, {
        ok: true,
        coordinate: {
          groupId: 'group1',
          artifactId: 'artifact1',
          version: 'version1',
        },
      });
    const received = await testableMethods.getMavenPackageInfo(
      'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
      {},
      'Bearer s0meT0ken',
    );
    expect(received).toBe('group1:artifact1@version1');
  });
});
