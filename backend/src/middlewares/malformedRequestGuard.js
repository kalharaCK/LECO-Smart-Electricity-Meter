/**
 * Malformed Request & Prototype Tampering Guard
 * Intercepts malformed URI percent-encodings, prototype pollution vectors,
 * and malformed request structures before they can trigger unhandled engine faults.
 */

function malformedUriGuard(req, res, next) {
  try {
    decodeURI(req.path);
    decodeURIComponent(req.path);
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed request URL encoding',
      status: 400,
      timestamp: new Date().toISOString()
    });
  }
}

function prototypePollutionGuard(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj, depth = 0) => {
      if (!obj || typeof obj !== 'object' || depth > 10) return;
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          try {
            delete obj[key];
          } catch (_) {}
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key], depth + 1);
        }
      }
    };
    sanitize(req.body);
  }
  next();
}

module.exports = {
  malformedUriGuard,
  prototypePollutionGuard
};
