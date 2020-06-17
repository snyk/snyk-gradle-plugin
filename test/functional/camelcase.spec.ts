import { exportsForTests as testableMethods } from '../../lib';

describe('validate strings camel case', () => {
  it('should convert strings to camel case', async () => {
    // verify 'should work with empty string'
    expect(testableMethods.toCamelCase('')).toBe('');
    // verify 'should returns the string unchanged when lowercase'
    expect(testableMethods.toCamelCase('ala')).toBe('ala');
    // verify 'should camelcase when all uppercase string'
    expect(testableMethods.toCamelCase('ALA')).toBe('ala');
    // verify 'should camelcase when having two words'
    expect(testableMethods.toCamelCase('ala bala')).toBe('alaBala');
    // verify 'should camelcase when having two words with uppercase'
    expect(testableMethods.toCamelCase('ALA BALA')).toBe('alaBala');
    // verify 'should camelcase when having two words with first letter of each word uppercase'
    expect(testableMethods.toCamelCase('Ala Bala')).toBe('alaBala');
  });
});
