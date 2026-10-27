const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const app = require('../src/app');

test('GET /api/metrics returns system performance and memory telemetry in JSON format', (t, done) => {
  const server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    const req = http.get(`http://127.0.0.1:${port}/api/metrics`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        assert.equal(res.statusCode, 200);
        const parsed = JSON.parse(data);
        assert.equal(parsed.success, true);
        assert.ok(parsed.system.uptimeSeconds >= 0);
        assert.ok(parsed.system.memory.heapUsedMb > 0);
        assert.ok(parsed.database.pool !== undefined);
        server.close(done);
      });
    });
    req.on('error', err => {
      server.close();
      done(err);
    });
  });
});

test('GET /api/metrics?format=prometheus returns prometheus-compatible text telemetry', (t, done) => {
  const server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    const req = http.get(`http://127.0.0.1:${port}/api/metrics?format=prometheus`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        assert.equal(res.statusCode, 200);
        assert.ok(res.headers['content-type'].includes('text/plain'));
        assert.ok(data.includes('process_uptime_seconds'));
        assert.ok(data.includes('process_memory_heap_used_bytes'));
        server.close(done);
      });
    });
    req.on('error', err => {
      server.close();
      done(err);
    });
  });
});
