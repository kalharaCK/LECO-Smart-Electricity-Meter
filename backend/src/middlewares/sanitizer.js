/**
 * Phase 5 Step 6: Input Sanitization & Strict Validation Middleware
 * Strips HTML tags and script injection payloads from user-provided inputs
 * Enforces maximum string lengths and strict data types to prevent Stored XSS.
 */

// Regex to strip any HTML tags, angle brackets, and script constructs
const HTML_TAG_REGEX = /<[^>]*>?/gm;
const JS_PROTOCOL_REGEX = /javascript\s*:/gim;
const EVENT_HANDLER_REGEX = /on\w+\s*=/gim;

/**
 * Strips HTML tags and dangerous script handlers from a string
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return str;
  let clean = str
    .replace(HTML_TAG_REGEX, '')
    .replace(JS_PROTOCOL_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .trim();
  if (maxLength && clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean;
}

/**
 * Recursively sanitizes an object, array, or primitive
 * @param {any} value 
 * @returns {any}
 */
function deepSanitize(value) {
  if (typeof value === 'string') {
    return sanitizeString(value, 2000);
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = deepSanitize(value[key]);
    }
    return cleaned;
  }
  return value;
}

/**
 * Global Express middleware that automatically sanitizes all incoming
 * req.body, req.query, and req.params fields before route handlers execute.
 */
function sanitizeInputs(req, res, next) {
  if (req.body) req.body = deepSanitize(req.body);
  if (req.query) req.query = deepSanitize(req.query);
  if (req.params) req.params = deepSanitize(req.params);
  next();
}

/**
 * Strict validator for Meter Linking & Registration
 */
function validateMeterInput(req, res, next) {
  const { meterNumber, accountNumber, pin, name } = req.body || {};

  if (!meterNumber || typeof meterNumber !== 'string') {
    return res.status(400).json({ message: 'Valid meterNumber is required' });
  }
  if (!accountNumber || typeof accountNumber !== 'string') {
    return res.status(400).json({ message: 'Valid accountNumber is required' });
  }
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ message: 'Valid pin is required' });
  }

  // Length constraints
  if (meterNumber.length > 50) {
    return res.status(400).json({ message: 'meterNumber exceeds maximum length of 50 characters' });
  }
  if (accountNumber.length > 50) {
    return res.status(400).json({ message: 'accountNumber exceeds maximum length of 50 characters' });
  }
  if (pin.length > 20) {
    return res.status(400).json({ message: 'pin exceeds maximum length of 20 characters' });
  }
  if (name && name.length > 100) {
    return res.status(400).json({ message: 'Meter name exceeds maximum length of 100 characters' });
  }

  // Ensure sanitized name
  if (name) {
    req.body.name = sanitizeString(name, 100);
  }

  next();
}

module.exports = {
  sanitizeString,
  deepSanitize,
  sanitizeInputs,
  validateMeterInput
};
