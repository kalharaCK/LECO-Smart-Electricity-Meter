/**
 * Standard API Response Envelope Helpers
 * Ensures consistent JSON structure across REST endpoints.
 */

function sendSuccess(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const payload = {
    success: true,
    message,
    data
  };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

function sendError(res, error = 'An unexpected error occurred', statusCode = 500, details = null) {
  const payload = {
    success: false,
    error: typeof error === 'string' ? error : error.message || 'Server error'
  };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};
