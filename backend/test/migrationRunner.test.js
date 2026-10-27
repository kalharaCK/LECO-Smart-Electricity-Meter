const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { runPendingMigrations } = require('../src/config/migrationRunner');

test('migration runner applies unapplied migrations and skips already executed ones', async () => {
  const queries = [];
  const appliedVersions = new Set();

  const fakeClient = {
    query: async (sql, params) => {
      queries.push({ sql: sql.trim(), params });
      if (sql.includes('SELECT version FROM schema_migrations')) {
        return { rows: Array.from(appliedVersions).map(v => ({ version: v })) };
      }
      if (sql.includes('INSERT INTO schema_migrations')) {
        appliedVersions.add(params[0]);
        return { rows: [] };
      }
      return { rows: [] };
    },
    release: () => {}
  };

  const fakePool = {
    connect: async () => fakeClient
  };

  // Create temporary migrations directory with 2 dummy migrations
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leco-mig-test-'));
  fs.writeFileSync(path.join(tempDir, '001_initial.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(tempDir, '002_extra.sql'), 'SELECT 2;');

  try {
    const firstRun = await runPendingMigrations(fakePool, tempDir);
    assert.deepEqual(firstRun.applied, ['001_initial.sql', '002_extra.sql']);
    assert.deepEqual(firstRun.skipped, []);

    // Second run should skip already applied migrations
    const secondRun = await runPendingMigrations(fakePool, tempDir);
    assert.deepEqual(secondRun.applied, []);
    assert.deepEqual(secondRun.skipped, ['001_initial.sql', '002_extra.sql']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
