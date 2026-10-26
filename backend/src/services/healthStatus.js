function createHealthResponse({ databaseHealthy, dbLatencyMs, uptimeSeconds, timestamp = new Date().toISOString() }) {
  return {
    httpStatus: databaseHealthy ? 200 : 503,
    body: {
      status: databaseHealthy ? 'ok' : 'degraded',
      service: 'LECO Smart AMI REST Engine',
      database: {
        status: databaseHealthy ? 'healthy' : 'unavailable',
        latencyMs: dbLatencyMs,
        provider: 'PostgreSQL',
      },
      uptimeSeconds,
      timestamp,
    },
  };
}

module.exports = { createHealthResponse };
