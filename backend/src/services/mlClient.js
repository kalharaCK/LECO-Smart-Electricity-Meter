/**
 * LECO Smart Electricity Meter - Machine Learning Service Client
 * Bridges the Node.js backend with the Python FastAPI Online ML Service.
 * Implements Circuit Breaker, timeout protection, and graceful degradation fallback.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SERVICE_TOKEN = process.env.ML_SERVICE_TOKEN;
const DEFAULT_TIMEOUT_MS = 500;

class CircuitBreaker {
  constructor(failureThreshold = 2, resetTimeoutMs = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failureCount = 0;
    this.state = 'CLOSED'; // 'CLOSED', 'OPEN', 'HALF_OPEN'
    this.nextAttempt = Date.now();
  }

  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      console.warn(`[ML Circuit Breaker]: Circuit OPEN. Python ML service requests paused for ${this.resetTimeoutMs / 1000}s.`);
    }
  }
}

const breaker = new CircuitBreaker();

/**
 * Low-level HTTP request helper with circuit breaker and timeout
 * @param {string} endpoint 
 * @param {object} options 
 * @returns {Promise<any|null>}
 */
async function mlFetch(endpoint, options = {}) {
  if (!breaker.canRequest()) {
    return null;
  }

  const url = `${ML_SERVICE_URL}${endpoint}`;
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(ML_SERVICE_TOKEN ? { 'X-ML-Service-Token': ML_SERVICE_TOKEN } : {}),
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(timeout)
    });

    if (!res.ok) {
      throw new Error(`ML Service responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    breaker.recordSuccess();
    return data;
  } catch (err) {
    breaker.recordFailure();
    // Non-fatal warning - system continues with fallback
    return null;
  }
}

/**
 * Checks health of the Python ML Service
 */
async function checkHealth() {
  return await mlFetch('/api/ml/health', { timeout: 1500 });
}

/**
 * Ingests incoming 30-45s telemetry pulse into the ML validation & online learning pipeline
 * @param {object} telemetry
 */
async function ingestTelemetry(telemetry) {
  const payload = {
    meter_id: Number(telemetry.meter_id || telemetry.meterId),
    timestamp: telemetry.timestamp || new Date().toISOString(),
    cumulative_kwh: Number(telemetry.cumulative_kwh || telemetry.cumulativeKwh || 0),
    prepaid_balance: telemetry.prepaid_balance !== undefined ? Number(telemetry.prepaid_balance) : undefined,
    connection_type: telemetry.connection_type || 'prepaid',
    tariff_id: telemetry.tariff_id || 'DOMESTIC_D1',
    billing_cycle_day: Number(telemetry.billing_cycle_day || new Date().getDate()),
    voltage: telemetry.voltage !== undefined ? Number(telemetry.voltage) : 230.0,
    current_amps: telemetry.current_amps !== undefined ? Number(telemetry.current_amps) : 0.0,
    power_factor: telemetry.power_factor !== undefined ? Number(telemetry.power_factor) : 0.95
  };

  return await mlFetch('/api/ml/telemetry/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeout: 3000
  });
}

/**
 * Fetches 24-step hourly energy forecast with confidence bands
 * @param {number|string} meterId 
 */
async function getHourlyForecast(meterId) {
  return await mlFetch(`/api/ml/forecast/hourly/${meterId}`);
}

/**
 * Simulates non-linear PUCSL domestic block tariff balance exhaustion
 * @param {number|string} meterId 
 * @param {number} [balanceOverride]
 */
async function getPrepaidLifetime(meterId, balanceOverride, options = {}) {
  const query = balanceOverride !== undefined ? `?balance=${balanceOverride}` : '';
  return await mlFetch(`/api/ml/forecast/prepaid/${meterId}${query}`, { timeout: 500, ...options });
}

/**
 * Forecasts end-of-cycle bill for postpaid electricity meters
 * @param {number|string} meterId 
 */
async function getPostpaidForecast(meterId) {
  return await mlFetch(`/api/ml/forecast/postpaid/${meterId}`);
}

/**
 * Forecasts next-month demand, recommended recharge, and consumer trend
 * @param {number|string} meterId 
 */
async function getRechargeDemand(meterId) {
  return await mlFetch(`/api/ml/forecast/demand/${meterId}`);
}

/**
 * Retrieves online model status, dynamic weights, and ADWIN drift state
 * @param {number|string} meterId 
 */
async function getModelStatus(meterId) {
  return await mlFetch(`/api/ml/models/status/${meterId}`);
}

module.exports = {
  checkHealth,
  ingestTelemetry,
  getHourlyForecast,
  getPrepaidLifetime,
  getPostpaidForecast,
  getRechargeDemand,
  getModelStatus,
  ML_SERVICE_URL
};
