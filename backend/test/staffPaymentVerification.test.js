const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.JWT_SECRET = 'payment-test-secret-with-more-than-thirty-two-characters';

const { pool } = require('../src/config/db');
const { verifyStaffPayhereTransaction } = require('../src/controllers/payhereController');

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeLedger() {
  const payment = { id: 5, meter_id: 9, transaction_id: 'order-5', amount: '50', status: 'Pending', new_balance: '100.00' };
  const meter = { id: 9, meter_number: 'LECO-9', balance: '100.00', status: 'Connected' };
  const statements = [];
  const originalConnect = pool.connect;
  pool.connect = async () => ({
    async query(sql, params = []) {
      statements.push(sql.trim());
      if (sql.startsWith('SELECT p.*')) return { rows: [{ ...payment, meter_number: meter.meter_number, current_meter_balance: meter.balance, current_meter_status: meter.status }] };
      if (sql.startsWith('SELECT id, balance, status FROM meters')) return { rows: [{ ...meter }] };
      if (sql.startsWith('UPDATE meters')) {
        meter.balance = String(params[0]);
        meter.status = params[1];
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE payments')) {
        payment.status = 'Success';
        payment.new_balance = String(params[0]);
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  });
  return { payment, meter, statements, restore: () => { pool.connect = originalConnect; } };
}

test('repeated staff approval credits a payment only once', async () => {
  const ledger = makeLedger();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = responseStub();
      await verifyStaffPayhereTransaction({
        params: { id: '5' },
        body: { action: 'approve' },
        user: { email: 'staff@example.com' },
      }, res);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(ledger.meter.balance, '150');
    assert.equal(ledger.payment.new_balance, '150');
    assert.equal(ledger.statements.filter((sql) => sql.startsWith('BEGIN')).length, 2);
    assert.equal(ledger.statements.filter((sql) => sql.startsWith('UPDATE meters')).length, 1);
  } finally {
    ledger.restore();
  }
});

test('staff cannot reject a payment that is already successful', async () => {
  const ledger = makeLedger();
  ledger.payment.status = 'Success';
  try {
    const res = responseStub();
    await verifyStaffPayhereTransaction({
      params: { id: '5' },
      body: { action: 'reject' },
      user: { email: 'staff@example.com' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(ledger.payment.status, 'Success');
  } finally {
    ledger.restore();
  }
});
