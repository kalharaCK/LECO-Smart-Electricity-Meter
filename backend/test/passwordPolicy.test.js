const test = require('node:test');
const assert = require('node:assert/strict');
const { validateNewPassword } = require('../src/services/passwordPolicy');

test('new passwords need at least ten characters', () => {
  assert.match(validateNewPassword('short123'), /at least 10/);
  assert.equal(validateNewPassword('long-enough-password'), null);
});

test('password validation rejects non-text and inputs beyond bcrypt byte limits', () => {
  assert.match(validateNewPassword(null), /must be text/);
  assert.match(validateNewPassword('é'.repeat(40)), /72 UTF-8 bytes/);
});
