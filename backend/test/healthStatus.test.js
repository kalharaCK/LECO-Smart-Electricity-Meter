const test = require('node:test');
const assert = require('node:assert/strict');
const { createHealthResponse } = require('../src/services/healthStatus');

test('healthy database produces a successful health response', () => {
  const result = createHealthResponse({ databaseHealthy: true, dbLatencyMs: 4, uptimeSeconds: 30, timestamp: 'test-time' });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.database.status, 'healthy');
});

test('database outages return 503 without exposing provider error details', () => {
  const result = createHealthResponse({ databaseHealthy: false, dbLatencyMs: 0, uptimeSeconds: 30, timestamp: 'test-time' });
  assert.equal(result.httpStatus, 503);
  assert.equal(result.body.status, 'degraded');
  assert.equal(result.body.database.status, 'unavailable');
  assert.equal(JSON.stringify(result.body).includes('password'), false);
});
