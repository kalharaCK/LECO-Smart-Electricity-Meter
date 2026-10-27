/**
 * Process-Level Crash Immunity & Resilient Supervisor
 * Protects the Node.js runtime against uncaught exceptions, unhandled promise rejections,
 * memory warnings, and orchestrates clean graceful shutdowns.
 */

const immunityMetrics = {
  unhandledRejectionsCaught: 0,
  uncaughtExceptionsCaught: 0,
  warningsLogged: 0,
  startedAt: new Date().toISOString(),
  isShuttingDown: false
};

/**
 * Strips sensitive credentials, database passwords, and auth tokens from error strings
 */
function sanitizeLog(input) {
  if (!input) return '';
  const text = typeof input === 'string' ? input : (input.stack || input.message || JSON.stringify(input));
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@[^\s/]+/gi, 'postgresql://[REDACTED_USER]:[REDACTED_PASS]@[HOST]')
    .replace(/(password|token|secret|authorization|key)=([^\s&]+)/gi, '$1=[REDACTED]');
}

let isInitialized = false;

/**
 * Configures process-level crash immunity hooks.
 * Guarantees that stray unhandled rejections or runtime exceptions in async tasks
 * will not crash the Node.js enterprise server.
 */
function setupProcessImmunity() {
  if (isInitialized) return;
  isInitialized = true;

  // 1. Prevent unhandled promise rejections from killing the process (Node.js >= 15 default behavior)
  process.on('unhandledRejection', (reason, promise) => {
    immunityMetrics.unhandledRejectionsCaught += 1;
    console.error('[Process Immunity] Intercepted Unhandled Rejection:', sanitizeLog(reason));
  });

  // 2. Prevent uncaught synchronous exceptions from causing immediate process termination
  process.on('uncaughtException', (err, origin) => {
    immunityMetrics.uncaughtExceptionsCaught += 1;
    console.error(`[Process Immunity] Intercepted Uncaught Exception (origin: ${origin}):`, sanitizeLog(err));
  });

  // 3. Monitor exceptions without interfering
  process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.warn(`[Process Immunity Telemetry] Exception monitor recorded event from ${origin}`);
  });

  // 4. Log Node.js process warnings (e.g. EventEmitter leaks, deprecation)
  process.on('warning', (warning) => {
    immunityMetrics.warningsLogged += 1;
    console.warn(`[Process Warning] ${warning.name}: ${warning.message}`);
  });
}

/**
 * Registers HTTP server and resources for graceful zero-downtime shutdown
 */
function registerGracefulShutdown(server, cleanups = {}) {
  const shutdown = async (signal) => {
    if (immunityMetrics.isShuttingDown) return;
    immunityMetrics.isShuttingDown = true;
    console.log(`\n[Process Immunity] Received ${signal}. Commencing graceful server shutdown...`);

    // Force exit timer if active requests don't finish within 10 seconds
    const forceExitTimer = setTimeout(() => {
      console.error('[Process Immunity] Graceful shutdown timeout reached. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    // Stop accepting new HTTP connections
    if (server && server.close) {
      server.close(async () => {
        console.log('[Process Immunity] HTTP server stopped accepting connections.');
        try {
          if (typeof cleanups.closeSocket === 'function') {
            await cleanups.closeSocket();
            console.log('[Process Immunity] WebSocket connections closed.');
          }
          if (typeof cleanups.closeDbPool === 'function') {
            await cleanups.closeDbPool();
            console.log('[Process Immunity] Database pool drained and closed.');
          }
        } catch (cleanupErr) {
          console.error('[Process Immunity] Error during graceful cleanup:', sanitizeLog(cleanupErr));
        } finally {
          clearTimeout(forceExitTimer);
          console.log('[Process Immunity] Shutdown complete. Exiting cleanly.');
          process.exit(0);
        }
      });
    } else {
      clearTimeout(forceExitTimer);
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Express middleware to gracefully reject incoming traffic when shutdown is in progress
 */
function shutdownGuardMiddleware(req, res, next) {
  if (immunityMetrics.isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      success: false,
      error: 'Server is currently undergoing maintenance/restart. Please retry shortly.',
      status: 503
    });
  }
  next();
}

/**
 * Returns diagnostic metrics regarding intercepted process exceptions
 */
function getImmunityMetrics() {
  return {
    ...immunityMetrics,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage()
  };
}

module.exports = {
  setupProcessImmunity,
  registerGracefulShutdown,
  shutdownGuardMiddleware,
  getImmunityMetrics,
  sanitizeLog
};
