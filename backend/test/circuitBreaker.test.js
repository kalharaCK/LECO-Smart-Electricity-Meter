const test = require('node:test');
const assert = require('node:assert/strict');
const CircuitBreaker = require('../src/utils/circuitBreaker');

test('circuit breaker allows successful calls in CLOSED state', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
  const result = await breaker.execute(async () => 'OK');
  assert.equal(result, 'OK');
  assert.equal(breaker.getState(), 'CLOSED');
});

test('circuit breaker opens after exceeding failure threshold and fails fast', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });

  // 1st failure
  await assert.rejects(breaker.execute(async () => { throw new Error('First failure'); }), /First failure/);
  assert.equal(breaker.getState(), 'CLOSED');

  // 2nd failure triggers OPEN
  await assert.rejects(breaker.execute(async () => { throw new Error('Second failure'); }), /Second failure/);
  assert.equal(breaker.getState(), 'OPEN');

  // 3rd call immediately fails fast without executing action
  let executed = false;
  await assert.rejects(
    breaker.execute(async () => { executed = true; return 'SHOULD_NOT_RUN'; }),
    (err) => err.code === 'CIRCUIT_OPEN'
  );
  assert.equal(executed, false);
});
