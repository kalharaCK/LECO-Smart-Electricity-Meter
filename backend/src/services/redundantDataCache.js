/**
 * Resilient Redundant Data Cache
 * Caches critical read-heavy reference datasets (e.g., PUCSL tariff tiers, system parameters).
 * In the event of a database failover or maintenance window, serves last-known-good
 * data to ensure seamless zero-downtime availability for consumers.
 */

class RedundantDataCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map(); // key -> { value, expiresAt, updatedAt }
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      updatedAt: now
    });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.value;
  }

  /**
   * Fetches data with transparent fallback to last-known-good cache on failure
   */
  async getWithFallback(key, fetcher, ttlMs = this.defaultTtlMs) {
    const entry = this.store.get(key);
    const now = Date.now();

    // If cache is fresh, return immediately
    if (entry && now < entry.expiresAt) {
      return { data: entry.value, isFallback: false, cached: true };
    }

    try {
      const freshData = await fetcher();
      this.set(key, freshData, ttlMs);
      return { data: freshData, isFallback: false, cached: false };
    } catch (fetchErr) {
      // Database or upstream query failed: check for redundant stale cache
      if (entry && entry.value !== undefined) {
        console.warn(`[Redundant Cache]: Upstream fetch failed (${fetchErr.message}). Serving last-known-good cache for '${key}'.`);
        return { data: entry.value, isFallback: true, cached: true, error: fetchErr.message };
      }
      throw fetchErr;
    }
  }

  invalidate(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const defaultCache = new RedundantDataCache();

module.exports = {
  RedundantDataCache,
  defaultCache
};
