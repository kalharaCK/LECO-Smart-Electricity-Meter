/**
 * Global API Error Handling Middleware
 * Ensures every REST API error returns a standard structured JSON response.
 */
const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err.stack || err.message || err);

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    status: statusCode,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

module.exports = { errorHandler };
