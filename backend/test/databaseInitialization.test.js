const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const { pool, initDb, connectDb } = require('../src/config/db');

test('schema initialization failure is propagated to startup', async () => {
  const originalQuery = pool.query;
  const originalConsoleError = console.error;
  pool.query = async () => { throw new Error('schema unavailable'); };
  console.error = () => {};

  try {
    await assert.rejects(initDb(), /schema unavailable/);
  } finally {
    pool.query = originalQuery;
    console.error = originalConsoleError;
  }
});

test('failed database connection releases its client and rejects startup', async () => {
  const originalConnect = pool.connect;
  const originalConsoleError = console.error;
  let released = false;
  pool.connect = async () => ({
    query: async () => { throw new Error('database unavailable'); },
    release: () => { released = true; },
  });
  console.error = () => {};

  try {
    await assert.rejects(connectDb(), /database unavailable/);
    assert.equal(released, true);
  } finally {
    pool.connect = originalConnect;
    console.error = originalConsoleError;
  }
});

test('production initializes PIN security migrations without seeding demo accounts', async () => {
  const originalQuery = pool.query;
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleLog = console.log;
  const queries = [];
  process.env.NODE_ENV = 'production';
  pool.query = async (sql) => {
    queries.push(sql);
    return { rows: [] };
  };
  console.log = () => {};

  try {
    await initDb();
    assert.ok(queries.some((sql) => sql.includes('SELECT id, pin FROM meters')));
    assert.equal(queries.some((sql) => sql.includes("email = 'staff@leco.lk'")), false);
    assert.equal(queries.some((sql) => sql.includes("email = 'customer@leco.lk'")), false);
  } finally {
    pool.query = originalQuery;
    console.log = originalConsoleLog;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});
