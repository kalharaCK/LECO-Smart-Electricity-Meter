const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSessionToken, meterRoomAccessQuery } = require('../src/services/socketSecurity');

test('session cookie parsing extracts only the token and safely decodes its value', () => {
  assert.equal(extractSessionToken('theme=dark; token=abc.def; other=value'), 'abc.def');
  assert.equal(extractSessionToken('theme=dark'), null);
  assert.throws(() => extractSessionToken('token=%E0%A4%A'));
});

test('customer meter-room queries are scoped to the authenticated owner', () => {
  assert.deepEqual(meterRoomAccessQuery('customer', 8, 12), [
    'SELECT id FROM meters WHERE id = $1 AND user_id = $2',
    [8, 12],
  ]);
});

test('staff meter-room queries are allowed while unknown roles have no access', () => {
  assert.deepEqual(meterRoomAccessQuery('staff', 8, 12), [
    'SELECT id FROM meters WHERE id = $1',
    [8],
  ]);
  assert.equal(meterRoomAccessQuery('guest', 8, 12), null);
});
