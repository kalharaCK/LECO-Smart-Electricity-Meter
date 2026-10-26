const rateLimit = require('express-rate-limit');

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 20;
const METER_LINK_MAX_ATTEMPTS = 10;

/**
 * Phase 4: Defend Against Automated Attacks (Brute Force)
 * Rate Limiter for Authentication endpoints (/api/auth/login, /api/login, /api/signup)
 */
const authRateLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  standardHeaders: true, // Draft-6 RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  statusCode: 429,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts from this IP address. Please try again after a few minutes.',
    statusCode: 429,
    retryAfterMinutes: 15
  },
  handler: (req, res, next, options) => {
    console.warn(`[Security - RateLimit] Rate limit reached from IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  }
});

/**
 * Rate Limiter for Smart Meter linking & PIN verification (/api/meters/add)
 */
const meterLinkRateLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: METER_LINK_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Too Many Requests',
    message: 'Too many meter verification attempts from this IP address. Please try again after a few minutes.',
    statusCode: 429,
    retryAfterMinutes: 15
  },
  handler: (req, res, next, options) => {
    console.warn(`[Security - RateLimit] Rate limit reached on meter link from IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  }
});

/**
 * Rate Limiter for Complaint Submissions (/api/complaints)
 */
const complaintRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Too Many Requests',
    message: 'Too many complaint submissions. Please wait a few minutes before submitting another ticket.',
    statusCode: 429,
    retryAfterMinutes: 15
  }
});

module.exports = {
  authRateLimiter,
  meterLinkRateLimiter,
  complaintRateLimiter,
  AUTH_WINDOW_MS,
  AUTH_MAX_ATTEMPTS,
  METER_LINK_MAX_ATTEMPTS
};

