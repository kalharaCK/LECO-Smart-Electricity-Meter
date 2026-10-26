const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrustedOriginGuard } = require('../src/middlewares/csrfProtection');

const guard = createTrustedOriginGuard(['https://customer.example.com']);

function runGuard({ method = 'POST', path = '/api/settings', origin, authorization, tokenCookie } = {}) {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  guard({ method, path, headers: { authorization }, cookies: tokenCookie ? { token: tokenCookie } : {}, get: (name) => name === 'origin' ? origin : undefined }, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('trusted browser origins can make state-changing requests', () => {
  assert.equal(runGuard({ origin: 'https://customer.example.com' }).nextCalled, true);
});

test('untrusted or missing browser origins are rejected', () => {
  assert.equal(runGuard({ origin: 'https://attacker.example' }).res.statusCode, 403);
  assert.equal(runGuard({ tokenCookie: 'ambient-session' }).res.statusCode, 403);
});

test('safe methods and the signed PayHere server webhook bypass browser origin checks', () => {
  assert.equal(runGuard({ method: 'GET' }).nextCalled, true);
  assert.equal(runGuard({ path: '/api/payments/payhere-notify' }).nextCalled, true);
});

test('non-browser clients may use explicit bearer authentication without an Origin', () => {
  assert.equal(runGuard({ authorization: 'Bearer test-token' }).nextCalled, true);
});
