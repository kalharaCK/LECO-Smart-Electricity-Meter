const rateLimit = require('express-rate-limit');

/**
 * Phase 4: Defend Against Automated Attacks (Brute Force)
 * Strict Rate Limiter for Authentication endpoints (/api/auth/login, /api/login)
 * Limit: 5 attempts per IP address every 15 minutes
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  standardHeaders: true, // Draft-6 RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  statusCode: 429,
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
    statusCode: 429,
    retryAfterMinutes: 15
  },
  handler: (req, res, next, options) => {
    console.warn(`[Security - RateLimit] Blocked auth brute-force attempt from IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  }
});

/**
 * Strict Rate Limiter for Smart Meter linking & PIN verification (/api/meters/add)
 * Limit: 5 attempts per IP address every 15 minutes
 * Prevents automated scripts from rapidly guessing 4-digit hardware PINs
 */
const meterLinkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Too Many Requests',
    message: 'Too many meter verification attempts from this IP address. Please try again after 15 minutes.',
    statusCode: 429,
    retryAfterMinutes: 15
  },
  handler: (req, res, next, options) => {
    console.warn(`[Security - RateLimit] Blocked meter PIN brute-force attempt from IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  }
});

module.exports = {
  authRateLimiter,
  meterLinkRateLimiter
};
