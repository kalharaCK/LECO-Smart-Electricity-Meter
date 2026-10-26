const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.JWT_SECRET = 'controller-test-secret-with-more-than-thirty-two-characters';

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const authController = require('../src/controllers/authController');
const authRoutes = require('../src/routes/authRoutes');

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    cookieValue: null,
    status(code) { this.statusCode = code; return this; },
    cookie(name, value) { this.cookieValue = { name, value }; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('session recovery cannot mint a JWT from an email address', () => {
  assert.equal(authController.getSessionToken, undefined);
  const paths = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.equal(paths.includes('/token'), false);
});

test('login sets the HTTP-only cookie without returning the bearer token', async () => {
  const originalQuery = pool.query;
  const passwordHash = await bcrypt.hash('valid-password', 4);
  pool.query = async () => ({
    rows: [{ id: 7, email: 'customer@example.com', password: passwordHash, role: 'customer' }],
  });

  try {
    const res = responseStub();
    await authController.login({ body: { email: 'customer@example.com', password: 'valid-password' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.cookieValue?.name, 'token');
    assert.equal(res.body?.user?.email, 'customer@example.com');
    assert.equal(Object.hasOwn(res.body, 'token'), false);
  } finally {
    pool.query = originalQuery;
  }
});

test('session profile endpoint returns user data without minting a token', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ id: 7, email: 'customer@example.com', role: 'customer' }] });

  try {
    const res = responseStub();
    await authController.getMe({ user: { id: 7 } }, res);
    assert.equal(res.body?.user?.email, 'customer@example.com');
    assert.equal(Object.hasOwn(res.body, 'token'), false);
  } finally {
    pool.query = originalQuery;
  }
});
