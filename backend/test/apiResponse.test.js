const test = require('node:test');
const assert = require('node:assert/strict');
const { sendSuccess, sendError } = require('../src/utils/apiResponse');

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('sendSuccess formats uniform envelope with data and metadata', () => {
  const res = responseStub();
  sendSuccess(res, { meterId: 10 }, 'Meter retrieved', 200, { page: 1, limit: 10 });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Meter retrieved');
  assert.deepEqual(res.body.data, { meterId: 10 });
  assert.deepEqual(res.body.meta, { page: 1, limit: 10 });
});

test('sendError formats error envelope with appropriate status code', () => {
  const res = responseStub();
  sendError(res, 'Meter not found', 404);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Meter not found');
});
