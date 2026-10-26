/**
 * Global API Error Handling Middleware
 * Ensures every REST API error returns a standard structured JSON response.
 */
function formatApiError(err, responseStatus = 200, path = '') {
  const candidateStatus = Number(err.statusCode || err.status || responseStatus);
  const statusCode = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  return {
    success: false,
    error: statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed'),
    status: statusCode,
    path,
    timestamp: new Date().toISOString()
  };
}

const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err.stack || err.message || err);
  const response = formatApiError(err, res.statusCode, req.originalUrl);
  res.status(response.status).json(response);
};

module.exports = { errorHandler, formatApiError };
