const fs = require('fs');
const path = require('path');

/**
 * Migration Runner
 * Tracks executed schema migrations in a dedicated 'schema_migrations' table
 * and executes unapplied migrations in alphabetical/version order.
 */

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  return new Set(result.rows.map(r => r.version));
}

async function runPendingMigrations(pool, migrationsDir) {
  const dir = migrationsDir || path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) {
    return { applied: [], skipped: [] };
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  const applied = [];
  const skipped = [];

  try {
    await client.query('BEGIN');
    await ensureMigrationTable(client);
    const executed = await getExecutedMigrations(client);

    for (const file of files) {
      if (executed.has(file)) {
        skipped.push(file);
        continue;
      }

      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      applied.push(file);
      console.log(`[Migration] Applied ${file} successfully.`);
    }

    await client.query('COMMIT');
    return { applied, skipped };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureMigrationTable,
  getExecutedMigrations,
  runPendingMigrations
};
