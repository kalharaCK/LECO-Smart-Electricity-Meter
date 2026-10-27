const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidNic, normalizeNic } = require('../src/utils/nicValidator');

test('validates valid old format NICs', () => {
  assert.equal(isValidNic('851234567V'), true);
  assert.equal(isValidNic('851234567v'), true);
  assert.equal(isValidNic('991234567X'), true);
  assert.equal(isValidNic('991234567x'), true);
});

test('validates valid new format NICs', () => {
  assert.equal(isValidNic('198512345678'), true);
  assert.equal(isValidNic('200012345678'), true);
});

test('rejects malformed or invalid NIC inputs', () => {
  assert.equal(isValidNic(''), false);
  assert.equal(isValidNic(null), false);
  assert.equal(isValidNic(undefined), false);
  assert.equal(isValidNic(123456789), false);
  assert.equal(isValidNic('85123456V'), false); // too short
  assert.equal(isValidNic('8512345678V'), false); // too long
  assert.equal(isValidNic('851234567A'), false); // wrong letter
  assert.equal(isValidNic('19851234567'), false); // 11 digits
  assert.equal(isValidNic('1985123456789'), false); // 13 digits
});

test('normalizes valid NIC to uppercase and returns null for invalid', () => {
  assert.equal(normalizeNic('  851234567v  '), '851234567V');
  assert.equal(normalizeNic('198512345678'), '198512345678');
  assert.equal(normalizeNic('invalid'), null);
});
