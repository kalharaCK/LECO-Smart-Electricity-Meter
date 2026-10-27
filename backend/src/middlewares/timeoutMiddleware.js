/**
 * Request Timeout Immunity Middleware
 * Prevents hanging connections and socket file-descriptor leaks by terminating
 * requests that fail to produce a response within the configured time boundary.
 */

function createTimeoutMiddleware(timeoutMs = 30000) {
  return function requestTimeout(req, res, next) {
    let timer = setTimeout(() => {
      if (!res.headersSent) {
        req.timedOut = true;
        console.warn(`[Timeout Warning]: ${req.method} ${req.originalUrl} exceeded ${timeoutMs}ms limit.`);
        res.status(504).json({
          success: false,
          error: `Request timeout: Gateway did not receive a timely response within ${Math.round(timeoutMs / 1000)}s`,
          status: 504,
          path: req.originalUrl,
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    // Unref timer so it does not block Node process termination if idle
    if (timer.unref) {
      timer.unref();
    }

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    res.on('finish', clear);
    res.on('close', clear);

    next();
  };
}

module.exports = { createTimeoutMiddleware };
