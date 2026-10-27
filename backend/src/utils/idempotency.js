/**
 * Idempotency & Retry Deduplication Manager
 * Prevents duplicate state mutations, double-credits, and redundant billing actions
 * when upstream gateways or mobile clients retransmit requests after network timeouts.
 */

class IdempotencyManager {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 10 * 60 * 1000; // 10 minutes default retention
    this.cache = new Map(); // key -> { status: 'processing' | 'completed', result: any, expiresAt: number }

    // Periodic sweep of expired idempotency keys
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  has(key) {
    if (!key) return false;
    const entry = this.cache.get(String(key));
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(String(key));
      return false;
    }
    return true;
  }

  get(key) {
    if (!this.has(key)) return null;
    return this.cache.get(String(key));
  }

  setProcessing(key) {
    if (!key) return;
    this.cache.set(String(key), {
      status: 'processing',
      result: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  setCompleted(key, result) {
    if (!key) return;
    this.cache.set(String(key), {
      status: 'completed',
      result,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  remove(key) {
    if (!key) return;
    this.cache.delete(String(key));
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  size() {
    return this.cache.size;
  }
}

const defaultManager = new IdempotencyManager();

/**
 * Express middleware that checks incoming idempotency keys
 * to serve previously cached responses upon repeated retries.
 */
function createIdempotencyMiddleware(manager = defaultManager, headerName = 'x-idempotency-key') {
  return function idempotencyMiddleware(req, res, next) {
    const key = req.headers[headerName.toLowerCase()];
    if (!key || req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const cached = manager.get(key);
    if (cached) {
      if (cached.status === 'processing') {
        return res.status(409).json({
          success: false,
          error: 'An identical request is currently being processed. Please do not retry concurrently.',
          status: 409
        });
      }

      if (cached.status === 'completed' && cached.result) {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(cached.result.status || 200).json(cached.result.body);
      }
    }

    manager.setProcessing(key);

    // Intercept res.json to cache response upon completion
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        manager.setCompleted(key, { status: res.statusCode, body });
      } else {
        manager.remove(key);
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  IdempotencyManager,
  defaultIdempotencyManager: defaultManager,
  createIdempotencyMiddleware
};
