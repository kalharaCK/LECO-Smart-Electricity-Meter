const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'unit-test-only-secret-with-at-least-32-characters';
const { requireAuth, requireCustomer, requireStaff, developmentOnly } = require('../src/middlewares/authMiddleware');

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function requestFor(role) {
  return {
    headers: { authorization: `Bearer ${jwt.sign({ id: 1, email: 'test@example.com', role }, process.env.JWT_SECRET)}` },
    cookies: {},
  };
}

test('authentication rejects missing tokens and accepts a signed bearer token', () => {
  const missingResponse = responseStub();
  let nextCalled = false;
  requireAuth({ headers: {}, cookies: {} }, missingResponse, () => { nextCalled = true; });
  assert.equal(missingResponse.statusCode, 401);
  assert.equal(nextCalled, false);

  const req = requestFor('customer');
  requireAuth(req, responseStub(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'customer');
});

test('role guards reject the opposite portal role', () => {
  const customerResponse = responseStub();
  requireCustomer(requestFor('staff'), customerResponse, () => assert.fail('staff reached customer handler'));
  assert.equal(customerResponse.statusCode, 403);

  const staffResponse = responseStub();
  requireStaff(requestFor('customer'), staffResponse, () => assert.fail('customer reached staff handler'));
  assert.equal(staffResponse.statusCode, 403);
});

test('development-only controls are disabled in production and work in development', () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const prodResponse = responseStub();
    let nextCalled = false;
    developmentOnly({}, prodResponse, () => { nextCalled = true; });
    assert.equal(prodResponse.statusCode, 404);
    assert.equal(nextCalled, false);

    process.env.NODE_ENV = 'development';
    developmentOnly({}, responseStub(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});
