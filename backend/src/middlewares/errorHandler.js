/**
 * Global API Error Handling & Crash Immunity Middleware
 * Ensures every REST API error returns a standard structured JSON response
 * without exposing internal server secrets, database stack traces, or crashing the process.
 */

function sanitizeErrorMessage(msg) {
  if (typeof msg !== 'string') return 'An error occurred';
  return msg
    .replace(/postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@[^\s/]+/gi, 'postgresql://[REDACTED]')
    .replace(/(password|token|secret|authorization|key)=([^\s&]+)/gi, '$1=[REDACTED]');
}

function formatApiError(err, responseStatus = 200, path = '') {
  let candidateStatus = Number(err.statusCode || err.status || responseStatus);
  let errorMessage = err.message || 'Request failed';

  // 1. JSON parsing syntax error from body-parser / express.json
  if ((err instanceof SyntaxError || err.name === 'SyntaxError') && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    candidateStatus = 400;
    errorMessage = 'Malformed JSON payload in request body';
  }
  // 2. URI percent-encoding errors
  else if (err instanceof URIError || err.name === 'URIError') {
    candidateStatus = 400;
    errorMessage = 'Malformed request URL encoding';
  }
  // 3. Payload size limit exceeded
  else if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    candidateStatus = 413;
    errorMessage = 'Request payload exceeds maximum allowed size (200kb)';
  }
  // 4. CORS policy rejection
  else if (errorMessage && errorMessage.includes('Origin is not allowed by CORS')) {
    candidateStatus = 403;
    errorMessage = 'CORS policy: Access denied for this origin';
  }
  // 5. JWT Authentication errors
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    candidateStatus = 401;
    errorMessage = 'Session expired or invalid. Please log in again.';
  }
  // 6. PostgreSQL Database Error codes
  else if (err.code) {
    if (err.code === '23505') {
      candidateStatus = 409;
      errorMessage = 'A record with matching unique details already exists.';
    } else if (err.code === '23503') {
      candidateStatus = 400;
      errorMessage = 'Referenced entity or record was not found.';
    } else if (err.code === '22P02') {
      candidateStatus = 400;
      errorMessage = 'Invalid input format or data type for field.';
    } else if (['08001', '08006', '57P01', '57P02', '57P03', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code)) {
      candidateStatus = 503;
      errorMessage = 'Database service temporarily unavailable. Please retry in a moment.';
    }
  }

  const statusCode = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;

  let finalError;
  if (statusCode === 503) {
    finalError = errorMessage;
  } else if (statusCode >= 500) {
    finalError = 'Internal Server Error';
  } else {
    finalError = sanitizeErrorMessage(errorMessage);
  }

  return {
    success: false,
    error: finalError,
    status: statusCode,
    path,
    timestamp: new Date().toISOString()
  };
}

const errorHandler = (err, req, res, next) => {
  // CRITICAL IMMUNITY CHECK: If response headers were already sent, delegate to Express
  // to prevent ERR_HTTP_HEADERS_SENT crash
  if (res.headersSent) {
    return next(err);
  }

  const response = formatApiError(err, res.statusCode, req.originalUrl);

  // Set Retry-After header on 503 service unavailable responses
  if (response.status === 503) {
    res.setHeader('Retry-After', '5');
  }

  const safeStack = err && err.stack ? sanitizeErrorMessage(err.stack) : sanitizeErrorMessage(err?.message || 'Unknown error');
  console.error(`[API Error ${response.status}] [${req.method} ${req.originalUrl}]:`, safeStack);

  res.status(response.status).json(response);
};

module.exports = { errorHandler, formatApiError, sanitizeErrorMessage };
