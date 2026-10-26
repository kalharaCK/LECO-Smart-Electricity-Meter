const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const { pool } = require('../src/config/db');
const meterController = require('../src/controllers/meterController');

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('staff topup rejects non-positive or NaN amounts', async () => {
  const res = responseStub();
  await meterController.staffTopupMeter({ params: { meterId: 1 }, body: { amount: -50 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);

  const resZero = responseStub();
  await meterController.staffTopupMeter({ params: { meterId: 1 }, body: { amount: 'abc' } }, resZero);
  assert.equal(resZero.statusCode, 400);
  assert.equal(resZero.body.success, false);
});

test('staff topup returns 404 when meter does not exist', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [] });

  try {
    const res = responseStub();
    await meterController.staffTopupMeter({ params: { meterId: 9999 }, body: { amount: 500 } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Meter not found.');
  } finally {
    pool.query = originalQuery;
  }
});

test('toggle relay returns 404 when target meter is not found', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [] });

  try {
    const res = responseStub();
    await meterController.toggleMeterRelay({ params: { meterId: 9999 }, body: { status: 'Disconnected' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    pool.query = originalQuery;
  }
});
