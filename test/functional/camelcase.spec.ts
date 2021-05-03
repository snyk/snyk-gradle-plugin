import { exportsForTests as testableMethods } from '../../lib';

describe('should convert strings to camel case', () => {
  it.each`
    input         | output       | msg
    ${''}         | ${''}        | ${'should work with empty string'}
    ${'ala'}      | ${'ala'}     | ${'should returns the string unchanged when lowercase'}
    ${'ALA'}      | ${'ala'}     | ${'should camelcase when all uppercase string'}
    ${'ala bala'} | ${'alaBala'} | ${'should camelcase when having two words'}
    ${'ALA BALA'} | ${'alaBala'} | ${'should camelcase when having two words with uppercase'}
    ${'Ala Bala'} | ${'alaBala'} | ${'should camelcase when having two words with first letter of each word uppercase'}
  `('function toCamelCase $msg', ({ input, output }) => {
    expect(testableMethods.toCamelCase(input)).toBe(output);
  });
});
