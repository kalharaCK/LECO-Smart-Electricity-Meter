const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const { pool } = require('../src/config/db');
const { recordAuditLog, formatAuditAction } = require('../src/services/auditService');

test('formatAuditAction standardizes action strings to upper snake case', () => {
  assert.equal(formatAuditAction('relay toggle'), 'RELAY_TOGGLE');
  assert.equal(formatAuditAction('  staff topup  '), 'STAFF_TOPUP');
  assert.equal(formatAuditAction(''), 'UNKNOWN_ACTION');
  assert.equal(formatAuditAction(null), 'UNKNOWN_ACTION');
});

test('recordAuditLog inserts audit record into database and returns logId', async () => {
  const originalQuery = pool.query;
  const captured = [];
  pool.query = async (sql, params) => {
    captured.push({ sql, params });
    return { rows: [{ id: 42, created_at: new Date() }] };
  };

  try {
    const result = await recordAuditLog({
      actorId: 5,
      actorRole: 'staff',
      action: 'RELAY_DISCONNECT',
      targetResource: 'meter',
      targetId: '101',
      details: { reason: 'Overdue balance' },
      ip: '127.0.0.1'
    });

    assert.equal(result.success, true);
    assert.equal(result.logId, 42);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].params[0], 5);
    assert.equal(captured[0].params[1], 'staff');
    assert.equal(captured[0].params[2], 'RELAY_DISCONNECT');
  } finally {
    pool.query = originalQuery;
  }
});
