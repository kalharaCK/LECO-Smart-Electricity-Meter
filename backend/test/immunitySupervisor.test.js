const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const { sanitizeLog, getImmunityMetrics } = require('../src/utils/immunitySupervisor');
const { formatApiError, errorHandler } = require('../src/middlewares/errorHandler');
const { isTransientDbError, resilientQuery, safeQuery } = require('../src/config/db');
const { asyncHandler } = require('../src/utils/asyncHandler');
const { malformedUriGuard, prototypePollutionGuard } = require('../src/middlewares/malformedRequestGuard');

test('sanitizeLog redacts database passwords and sensitive tokens', () => {
  const sensitiveString = 'postgres://postgres:SuperSecretPassword123@ep-cool-db.us-east-2.neon.tech/leco_db?sslmode=require';
  const sanitized = sanitizeLog(sensitiveString);
  assert.equal(sanitized.includes('SuperSecretPassword123'), false);
  assert.equal(sanitized.includes('[REDACTED_PASS]'), true);

  const queryWithToken = 'Error occurred with token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9&password=myPlainPassword';
  const sanitizedQuery = sanitizeLog(queryWithToken);
  assert.equal(sanitizedQuery.includes('myPlainPassword'), false);
  assert.equal(sanitizedQuery.includes('token=[REDACTED]'), true);
});

test('formatApiError handles malformed JSON body SyntaxError with HTTP 400', () => {
  const syntaxErr = new SyntaxError('Unexpected token in JSON');
  syntaxErr.status = 400;
  syntaxErr.body = '{"bad json"';

  const res = formatApiError(syntaxErr, 200, '/api/auth/login');
  assert.equal(res.status, 400);
  assert.equal(res.error, 'Malformed JSON payload in request body');
  assert.equal(res.success, false);
});

test('formatApiError handles URIError with HTTP 400', () => {
  const uriErr = new URIError('Failed to decode param');
  const res = formatApiError(uriErr, 200, '/api/meters/%c0%ae');
  assert.equal(res.status, 400);
  assert.equal(res.error, 'Malformed request URL encoding');
});

test('formatApiError handles Payload Too Large (413)', () => {
  const payloadErr = new Error('request entity too large');
  payloadErr.type = 'entity.too.large';
  payloadErr.status = 413;

  const res = formatApiError(payloadErr, 200, '/api/chat');
  assert.equal(res.status, 413);
  assert.equal(res.error, 'Request payload exceeds maximum allowed size (200kb)');
});

test('formatApiError handles CORS rejection with HTTP 403', () => {
  const corsErr = new Error('Origin is not allowed by CORS');
  const res = formatApiError(corsErr, 200, '/api/meters');
  assert.equal(res.status, 403);
  assert.equal(res.error, 'CORS policy: Access denied for this origin');
});

test('formatApiError formats PostgreSQL unique violation 23505 as HTTP 409', () => {
  const dbErr = new Error('duplicate key value violates unique constraint');
  dbErr.code = '23505';
  const res = formatApiError(dbErr, 200, '/api/auth/signup');
  assert.equal(res.status, 409);
  assert.equal(res.error, 'A record with matching unique details already exists.');
});

test('formatApiError formats PostgreSQL connection outage as HTTP 503', () => {
  const dbErr = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  dbErr.code = 'ECONNREFUSED';
  const res = formatApiError(dbErr, 200, '/api/meters');
  assert.equal(res.status, 503);
  assert.equal(res.error, 'Database service temporarily unavailable. Please retry in a moment.');
});

test('errorHandler middleware delegates to next(err) if headers are already sent', () => {
  let nextCalledWith = null;
  const mockReq = { originalUrl: '/api/test', method: 'GET' };
  const mockRes = {
    headersSent: true,
    status: () => { throw new Error('Should not call status when headersSent is true'); },
    json: () => {}
  };
  const mockErr = new Error('Late stream error');

  errorHandler(mockErr, mockReq, mockRes, (err) => {
    nextCalledWith = err;
  });

  assert.equal(nextCalledWith, mockErr);
});

test('isTransientDbError correctly identifies network drops and disconnects', () => {
  assert.equal(isTransientDbError({ code: 'ECONNREFUSED' }), true);
  assert.equal(isTransientDbError({ code: '08006' }), true);
  assert.equal(isTransientDbError({ code: '57P01' }), true);
  assert.equal(isTransientDbError(new Error('Connection terminated unexpectedly')), true);
  assert.equal(isTransientDbError(new Error('client was closed')), true);

  // Normal constraint violations are NOT transient
  assert.equal(isTransientDbError({ code: '23505' }), false);
  assert.equal(isTransientDbError(new Error('Syntax error in query')), false);
});

test('asyncHandler captures rejected promises and passes to next middleware', async () => {
  let capturedError = null;
  const failingRoute = asyncHandler(async () => {
    throw new Error('Async unexpected crash');
  });

  await failingRoute({}, {}, (err) => {
    capturedError = err;
  });

  assert.ok(capturedError);
  assert.equal(capturedError.message, 'Async unexpected crash');
});

test('malformedUriGuard blocks invalid percent-encoded URLs with HTTP 400', () => {
  let jsonResponse = null;
  let statusSet = null;

  const mockReq = { path: '/api/%c0%ae' };
  const mockRes = {
    status: (s) => { statusSet = s; return { json: (d) => { jsonResponse = d; } }; }
  };

  malformedUriGuard(mockReq, mockRes, () => {});
  assert.equal(statusSet, 400);
  assert.equal(jsonResponse.error, 'Malformed request URL encoding');
});

test('prototypePollutionGuard strips __proto__ and constructor keys from JSON bodies', () => {
  const maliciousBody = {
    user: 'customer',
    __proto__: { isAdmin: true },
    nested: {
      constructor: 'tampered',
      validData: 123
    }
  };

  const req = { body: maliciousBody };
  prototypePollutionGuard(req, {}, () => {});

  assert.equal(Object.prototype.hasOwnProperty.call(req.body, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(req.body.nested, 'constructor'), false);
  assert.equal(req.body.nested.validData, 123);
});

test('getImmunityMetrics returns process health and exception statistics', () => {
  const metrics = getImmunityMetrics();
  assert.equal(typeof metrics.unhandledRejectionsCaught, 'number');
  assert.equal(typeof metrics.uncaughtExceptionsCaught, 'number');
  assert.equal(typeof metrics.uptimeSeconds, 'number');
  assert.equal(typeof metrics.memoryUsage, 'object');
});
