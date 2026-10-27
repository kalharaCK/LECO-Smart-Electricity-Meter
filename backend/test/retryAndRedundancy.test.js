const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const { retryWithBackoff, executeWithFallback, isTransientError, getReliabilityMetrics } = require('../src/utils/retryEngine');
const { IdempotencyManager, createIdempotencyMiddleware } = require('../src/utils/idempotency');
const { RedundantDataCache } = require('../src/services/redundantDataCache');
const smsService = require('../src/services/smsService');

test('isTransientError accurately identifies transient network and gateway statuses', () => {
  assert.equal(isTransientError({ status: 503 }), true);
  assert.equal(isTransientError({ statusCode: 429 }), true);
  assert.equal(isTransientError({ code: 'ECONNRESET' }), true);
  assert.equal(isTransientError({ code: 'ETIMEDOUT' }), true);
  assert.equal(isTransientError(new Error('socket hang up')), true);
  assert.equal(isTransientError(new Error('connection reset by peer')), true);

  // Client business validation errors are NOT transient
  assert.equal(isTransientError({ status: 400 }), false);
  assert.equal(isTransientError({ status: 401 }), false);
  assert.equal(isTransientError({ status: 404 }), false);
});

test('retryWithBackoff returns immediately on first successful attempt', async () => {
  let callCount = 0;
  const result = await retryWithBackoff(async () => {
    callCount += 1;
    return 'immediate_success';
  }, { maxRetries: 3 });

  assert.equal(result, 'immediate_success');
  assert.equal(callCount, 1);
});

test('retryWithBackoff recovers and succeeds on subsequent attempt after transient failure', async () => {
  let attempts = 0;
  const result = await retryWithBackoff(async () => {
    attempts += 1;
    if (attempts < 2) {
      const err = new Error('Transient socket drop');
      err.code = 'ECONNRESET';
      throw err;
    }
    return 'recovered_success';
  }, { maxRetries: 3, initialDelayMs: 20 });

  assert.equal(result, 'recovered_success');
  assert.equal(attempts, 2);
});

test('retryWithBackoff exhausts retries and propagates error after max attempts', async () => {
  let attempts = 0;
  await assert.rejects(
    retryWithBackoff(async () => {
      attempts += 1;
      const err = new Error('Gateway 504 timeout');
      err.status = 504;
      throw err;
    }, { maxRetries: 2, initialDelayMs: 10 }),
    /Gateway 504 timeout/
  );

  assert.equal(attempts, 3); // initial attempt + 2 retries
});

test('executeWithFallback transparently switches to secondary provider when primary fails', async () => {
  let primaryCalled = false;
  let fallbackCalled = false;

  const result = await executeWithFallback(
    async () => {
      primaryCalled = true;
      const err = new Error('Primary gateway down');
      err.status = 503;
      throw err;
    },
    async (primaryErr) => {
      fallbackCalled = true;
      return { provider: 'secondary_backup', recoveredFrom: primaryErr.message };
    },
    { maxRetries: 1, initialDelayMs: 10 }
  );

  assert.equal(primaryCalled, true);
  assert.equal(fallbackCalled, true);
  assert.equal(result.provider, 'secondary_backup');
  assert.equal(result.recoveredFrom, 'Primary gateway down');
});

test('IdempotencyManager prevents duplicate execution on retransmitted requests', () => {
  const manager = new IdempotencyManager({ ttlMs: 5000 });
  const key = 'req_idempotent_12345';

  assert.equal(manager.has(key), false);

  manager.setProcessing(key);
  assert.equal(manager.has(key), true);
  assert.equal(manager.get(key).status, 'processing');

  manager.setCompleted(key, { status: 200, body: { credited: 1000 } });
  assert.equal(manager.get(key).status, 'completed');
  assert.equal(manager.get(key).result.body.credited, 1000);
});

test('createIdempotencyMiddleware blocks concurrent identical requests with 409', () => {
  const manager = new IdempotencyManager();
  manager.setProcessing('txn_race_key');
  const middleware = createIdempotencyMiddleware(manager, 'x-idempotency-key');

  const req = { method: 'POST', headers: { 'x-idempotency-key': 'txn_race_key' } };
  let statusSet = null;
  let jsonResponse = null;
  const res = {
    status: (s) => { statusSet = s; return { json: (b) => { jsonResponse = b; } }; }
  };

  middleware(req, res, () => {});
  assert.equal(statusSet, 409);
  assert.equal(jsonResponse.error.includes('concurrently'), true);
});

test('createIdempotencyMiddleware replays completed response with X-Idempotent-Replay header', () => {
  const manager = new IdempotencyManager();
  manager.setCompleted('txn_replay_key', { status: 200, body: { balance: 2500 } });
  const middleware = createIdempotencyMiddleware(manager, 'x-idempotency-key');

  const req = { method: 'POST', headers: { 'x-idempotency-key': 'txn_replay_key' } };
  let statusSet = null;
  let jsonResponse = null;
  let headerSet = {};
  const res = {
    setHeader: (k, v) => { headerSet[k] = v; },
    status: (s) => { statusSet = s; return { json: (b) => { jsonResponse = b; } }; }
  };

  middleware(req, res, () => {});
  assert.equal(statusSet, 200);
  assert.equal(jsonResponse.balance, 2500);
  assert.equal(headerSet['X-Idempotent-Replay'], 'true');
});

test('RedundantDataCache serves last-known-good cache on upstream failure', async () => {
  const cache = new RedundantDataCache(100); // 100ms TTL
  const key = 'tariff_rates';

  // 1. Initial successful fetch
  const initial = await cache.getWithFallback(key, async () => {
    return { tier1: 5.0, tier2: 9.0 };
  });
  assert.equal(initial.data.tier1, 5.0);
  assert.equal(initial.isFallback, false);

  // 2. Wait for TTL to expire
  await new Promise(r => setTimeout(r, 150));

  // 3. Upstream fails (simulated DB restart), cache seamlessly falls back to stale data
  const fallbackResult = await cache.getWithFallback(key, async () => {
    throw new Error('Database connection failed');
  });

  assert.equal(fallbackResult.data.tier1, 5.0);
  assert.equal(fallbackResult.isFallback, true);
  assert.equal(fallbackResult.error, 'Database connection failed');
});

test('getReliabilityMetrics returns structured retry and fallback metrics', () => {
  const metrics = getReliabilityMetrics();
  assert.equal(typeof metrics.totalRetries, 'number');
  assert.equal(typeof metrics.successfulRetries, 'number');
  assert.equal(typeof metrics.exhaustedRetries, 'number');
  assert.equal(typeof metrics.fallbackActivations, 'number');
});
