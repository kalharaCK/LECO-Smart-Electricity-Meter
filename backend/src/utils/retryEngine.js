/**
 * Enterprise Retry & Redundancy Engine
 * Provides exponential backoff with full jitter, circuit-breaking integration,
 * and seamless fallback execution chains to maintain enterprise reliability.
 */

const reliabilityMetrics = {
  totalRetries: 0,
  successfulRetries: 0,
  exhaustedRetries: 0,
  fallbackActivations: 0,
  lastRetryAt: null
};

/**
 * Determines whether an error is transient and eligible for retry
 */
function isTransientError(err) {
  if (!err) return false;

  // HTTP status codes eligible for retry
  const status = Number(err.status || err.statusCode || err.response?.status);
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  // Network and socket system error codes
  const code = String(err.code || '');
  const transientCodes = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
    'ENOTFOUND',
    'ENETUNREACH',
    'ERR_SOCKET_TIMEOUT'
  ]);
  if (transientCodes.has(code)) return true;

  // Textual indicators of transient socket/stream drop
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('socket hang up') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('connection reset') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes an asynchronous function with exponential backoff and randomized jitter
 *
 * @param {Function} fn - Asynchronous function to execute
 * @param {Object} options - Configuration options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.initialDelayMs=150] - Initial delay in ms
 * @param {number} [options.maxDelayMs=3000] - Cap on exponential delay
 * @param {number} [options.backoffFactor=2] - Exponential multiplier
 * @param {boolean} [options.jitter=true] - Apply full randomized jitter
 * @param {Function} [options.retryIf=isTransientError] - Custom predicate to determine retry eligibility
 * @param {Function} [options.onRetry] - Observer callback on each retry attempt
 */
async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 150;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const backoffFactor = options.backoffFactor ?? 2;
  const useJitter = options.jitter ?? true;
  const shouldRetry = options.retryIf ?? isTransientError;

  let attempt = 0;
  let lastError;

  while (true) {
    try {
      const result = await fn(attempt);
      if (attempt > 0) {
        reliabilityMetrics.successfulRetries += 1;
      }
      return result;
    } catch (err) {
      lastError = err;
      attempt += 1;

      if (attempt > maxRetries || !shouldRetry(err)) {
        if (attempt > maxRetries) {
          reliabilityMetrics.exhaustedRetries += 1;
        }
        throw err;
      }

      reliabilityMetrics.totalRetries += 1;
      reliabilityMetrics.lastRetryAt = new Date().toISOString();

      // Exponential backoff calculation: delay = min(maxDelay, initialDelay * (factor ^ (attempt - 1)))
      const rawDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(backoffFactor, attempt - 1));
      // Full jitter: uniformly distributed random between 0 and rawDelay
      const delayMs = useJitter
        ? Math.floor(Math.random() * rawDelay) + Math.floor(rawDelay / 2)
        : rawDelay;

      if (typeof options.onRetry === 'function') {
        try {
          options.onRetry(err, attempt, delayMs);
        } catch (_) {}
      } else {
        console.warn(`[RetryEngine] Transient failure (${err.code || err.message}). Retrying attempt ${attempt}/${maxRetries} in ${delayMs}ms...`);
      }

      await sleep(delayMs);
    }
  }
}

/**
 * Executes a primary operation with retries. If the primary operation fails or exhausts
 * all retries, seamlessly executes the fallback redundancy function.
 *
 * @param {Function} primaryFn - Primary action to execute
 * @param {Function} fallbackFn - Redundant fallback function
 * @param {Object} options - Retry options for the primary function
 */
async function executeWithFallback(primaryFn, fallbackFn, options = {}) {
  try {
    return await retryWithBackoff(primaryFn, options);
  } catch (primaryErr) {
    reliabilityMetrics.fallbackActivations += 1;
    console.warn(`[RedundancyEngine] Primary service degraded: ${primaryErr.message}. Switching to redundant fallback provider...`);
    return await fallbackFn(primaryErr);
  }
}

/**
 * Returns diagnostic metrics for observability and health checks
 */
function getReliabilityMetrics() {
  return {
    ...reliabilityMetrics,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  retryWithBackoff,
  executeWithFallback,
  isTransientError,
  getReliabilityMetrics
};
