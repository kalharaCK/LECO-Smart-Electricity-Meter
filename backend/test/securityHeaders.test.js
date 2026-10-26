const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const app = require('../src/app');

test('app responds with hardened security headers including X-Frame-Options and Referrer-Policy', (t, done) => {
  const server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.equal(res.headers['x-powered-by'], undefined);
      server.close(done);
    });
    req.on('error', (err) => {
      server.close();
      done(err);
    });
  });
});
