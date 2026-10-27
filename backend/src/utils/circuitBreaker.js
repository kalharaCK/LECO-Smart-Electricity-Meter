/**
 * Circuit Breaker Pattern Utility
 * Wraps external asynchronous calls (SMS, Payment Gateway, OpenAI)
 * to prevent cascaded failure when downstream services degrade.
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 5000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.consecutiveFailures = 0;
    this.nextAttempt = Date.now();
  }

  async execute(action) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        const error = new Error('Circuit breaker is OPEN. Fast-failing external request.');
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }

  getState() {
    return this.state;
  }
}

module.exports = CircuitBreaker;
