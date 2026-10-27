const { getPoolStats } = require('../config/db');
const { getReliabilityMetrics } = require('../utils/retryEngine');

/**
 * Controller providing system performance metrics
 * Supports both JSON format (/api/metrics) and Prometheus text format (/api/metrics?format=prometheus)
 */
const getMetrics = async (req, res) => {
  const memory = process.memoryUsage();
  const uptime = process.uptime();
  const poolStats = getPoolStats ? getPoolStats() : { total: 0, idle: 0, waiting: 0 };
  const reliability = getReliabilityMetrics();

  if (req.query.format === 'prometheus') {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    const prometheusText = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptime.toFixed(2)}`,
      '# HELP process_memory_heap_used_bytes Process heap memory used in bytes.',
      '# TYPE process_memory_heap_used_bytes gauge',
      `process_memory_heap_used_bytes ${memory.heapUsed}`,
      '# HELP process_memory_rss_bytes Process resident set size in bytes.',
      '# TYPE process_memory_rss_bytes gauge',
      `process_memory_rss_bytes ${memory.rss}`,
      '# HELP db_pool_connections_total Total connections in pool.',
      '# TYPE db_pool_connections_total gauge',
      `db_pool_connections_total ${poolStats.total || 0}`,
      '# HELP db_pool_connections_idle Idle connections in pool.',
      '# TYPE db_pool_connections_idle gauge',
      `db_pool_connections_idle ${poolStats.idle || 0}`,
      '# HELP reliability_retries_total Total retry attempts executed.',
      '# TYPE reliability_retries_total counter',
      `reliability_retries_total ${reliability.totalRetries || 0}`,
      '# HELP reliability_fallbacks_total Total fallback activations.',
      '# TYPE reliability_fallbacks_total counter',
      `reliability_fallbacks_total ${reliability.fallbackActivations || 0}`
    ].join('\n');
    return res.send(prometheusText);
  }

  return res.json({
    success: true,
    system: {
      uptimeSeconds: Math.floor(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100
      }
    },
    database: {
      pool: poolStats
    },
    reliability,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getMetrics
};
