const test = require('node:test');
const assert = require('node:assert/strict');
const { AUTH_WINDOW_MS, AUTH_MAX_ATTEMPTS, METER_LINK_MAX_ATTEMPTS } = require('../src/middlewares/rateLimiter');

test('sensitive authentication and meter-link flows use bounded attempt windows', () => {
  assert.equal(AUTH_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(AUTH_MAX_ATTEMPTS, 20);
  assert.equal(METER_LINK_MAX_ATTEMPTS, 10);
});
