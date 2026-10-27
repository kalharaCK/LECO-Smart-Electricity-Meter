const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.JWT_SECRET = 'controller-test-secret-with-more-than-thirty-two-characters';

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const settingsController = require('../src/controllers/settingsController');

function createResponseStub() {
  return {
    statusCode: 200,
    body: null,
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    }
  };
}

test('deleteCustomerAccount rejects request if password is not provided', async () => {
  const req = {
    user: { id: 101, email: 'customer@example.com' },
    body: {}
  };
  const res = createResponseStub();

  await settingsController.deleteCustomerAccount(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Password is required/i);
});

test('deleteCustomerAccount rejects request if user is not authenticated', async () => {
  const req = {
    user: null,
    body: { password: 'SomePassword123' }
  };
  const res = createResponseStub();

  await settingsController.deleteCustomerAccount(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('deleteCustomerAccount rejects request if user not found in database', async () => {
  const originalConnect = pool.connect;
  pool.connect = async () => ({
    query: async (text) => {
      if (text.includes('SELECT id, email, password, role')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    release: () => {}
  });

  try {
    const req = {
      user: { id: 999, email: 'nonexistent@example.com' },
      body: { password: 'ValidPassword123' }
    };
    const res = createResponseStub();

    await settingsController.deleteCustomerAccount(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    pool.connect = originalConnect;
  }
});

test('deleteCustomerAccount forbids deleting staff or admin accounts via customer endpoint', async () => {
  const originalConnect = pool.connect;
  pool.connect = async () => ({
    query: async (text) => {
      if (text.includes('SELECT id, email, password, role')) {
        return { rows: [{ id: 5, email: 'staff@leco.lk', password: 'hash', role: 'staff' }] };
      }
      return { rows: [] };
    },
    release: () => {}
  });

  try {
    const req = {
      user: { id: 5, email: 'staff@leco.lk' },
      body: { password: 'ValidPassword123' }
    };
    const res = createResponseStub();

    await settingsController.deleteCustomerAccount(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
  } finally {
    pool.connect = originalConnect;
  }
});

test('deleteCustomerAccount rejects deletion with 401 if password does not match', async () => {
  const originalConnect = pool.connect;
  const realHash = await bcrypt.hash('CorrectPassword123', 4);

  pool.connect = async () => ({
    query: async (text) => {
      if (text.includes('SELECT id, email, password, role')) {
        return { rows: [{ id: 10, email: 'user@leco.lk', password: realHash, role: 'customer' }] };
      }
      return { rows: [] };
    },
    release: () => {}
  });

  try {
    const req = {
      user: { id: 10, email: 'user@leco.lk' },
      body: { password: 'WrongPassword456' }
    };
    const res = createResponseStub();

    await settingsController.deleteCustomerAccount(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Incorrect password/i);
  } finally {
    pool.connect = originalConnect;
  }
});

test('deleteCustomerAccount executes atomic cascade and clears cookie when password matches', async () => {
  const originalConnect = pool.connect;
  const realPassword = 'ValidCustomerPassword123';
  const realHash = await bcrypt.hash(realPassword, 4);
  const queriesRun = [];

  pool.connect = async () => ({
    query: async (text, params) => {
      queriesRun.push({ text, params });
      if (text.includes('SELECT id, email, password, role')) {
        return { rows: [{ id: 10, email: 'user@leco.lk', password: realHash, role: 'customer' }] };
      }
      return { rows: [] };
    },
    release: () => {}
  });

  try {
    const req = {
      user: { id: 10, email: 'user@leco.lk' },
      body: { password: realPassword }
    };
    const res = createResponseStub();

    await settingsController.deleteCustomerAccount(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.clearedCookies.length, 1);
    assert.equal(res.clearedCookies[0].name, 'token');

    // Verify atomic transaction commands were executed
    const queryTexts = queriesRun.map(q => q.text);
    assert.ok(queryTexts.includes('BEGIN'));
    assert.ok(queryTexts.some(q => q.includes('DELETE FROM notifications WHERE user_id = $1')));
    assert.ok(queryTexts.some(q => q.includes('UPDATE meters SET user_id = NULL WHERE user_id = $1')));
    assert.ok(queryTexts.some(q => q.includes('UPDATE payments SET user_id = NULL WHERE user_id = $1')));
    assert.ok(queryTexts.some(q => q.includes('DELETE FROM complaints WHERE user_id = $1')));
    assert.ok(queryTexts.some(q => q.includes('DELETE FROM user_settings WHERE user_id = $1')));
    assert.ok(queryTexts.some(q => q.includes('DELETE FROM users WHERE id = $1')));
    assert.ok(queryTexts.includes('COMMIT'));
  } finally {
    pool.connect = originalConnect;
  }
});
