const test = require('node:test');
const assert = require('node:assert/strict');
const { formatApiError } = require('../src/middlewares/errorHandler');

test('server errors return a generic message instead of provider details', () => {
  const response = formatApiError({ status: 500, message: 'password authentication failed for db user' }, 200, '/api/meters');
  assert.equal(response.status, 500);
  assert.equal(response.error, 'Internal Server Error');
  assert.equal(JSON.stringify(response).includes('password authentication'), false);
});

test('client errors preserve useful validation messages and status codes', () => {
  const response = formatApiError({ statusCode: 400, message: 'Email is required' }, 200, '/api/auth/login');
  assert.equal(response.status, 400);
  assert.equal(response.error, 'Email is required');
});
