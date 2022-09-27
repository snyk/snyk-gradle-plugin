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
