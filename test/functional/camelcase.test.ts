import { test } from 'tap';
import { exportsForTests as testableMethods } from '../../lib';

test('should convert strings to camel case', async (t) => {
  t.equal(testableMethods.toCamelCase(''), '', 'should work with empty string');
  t.equal(
    testableMethods.toCamelCase('ala'),
    'ala',
    'should returns the string unchanged when lowercase',
  );
  t.equal(
    testableMethods.toCamelCase('ALA'),
    'ala',
    'should camelcase when all uppercase string',
  );
  t.equal(
    testableMethods.toCamelCase('ala bala'),
    'alaBala',
    'should camelcase when having two words',
  );
  t.equal(
    testableMethods.toCamelCase('ALA BALA'),
    'alaBala',
    'should camelcase when having two words with uppercase',
  );
  t.equal(
    testableMethods.toCamelCase('Ala Bala'),
    'alaBala',
    'should camelcase when having two words with first letter of each word uppercase',
  );
});
