const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS meters (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        meter_number VARCHAR(100) UNIQUE NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        pin VARCHAR(255) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Connected',
        daily_average DECIMAL(10, 2) DEFAULT 0.00,
        name VARCHAR(100) DEFAULT 'Home',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS consumption_logs (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meters(id),
        reading_date DATE NOT NULL,
        reading_hour INTEGER NOT NULL,
        consumption DECIMAL(10, 2) NOT NULL,
        energy_export DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        meter_id INTEGER REFERENCES meters(id),
        type VARCHAR(50) NOT NULL, -- e.g., 'alert', 'success', 'info'
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        meter_id INTEGER REFERENCES meters(id),
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'card',
        transaction_id VARCHAR(100) UNIQUE NOT NULL,
        idempotency_key VARCHAR(100) UNIQUE,
        previous_balance DECIMAL(10, 2) NOT NULL,
        new_balance DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE;
      ALTER TABLE meters ADD COLUMN IF NOT EXISTS emergency_credit_limit DECIMAL(10, 2) DEFAULT 500.00;
      ALTER TABLE meters ADD COLUMN IF NOT EXISTS emergency_credit_active BOOLEAN DEFAULT FALSE;
      ALTER TABLE meters ADD COLUMN IF NOT EXISTS emergency_credit_activated_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meter_id INTEGER REFERENCES meters(id) ON DELETE SET NULL,
        complaint_type VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'submitted',
        resolution_notes TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(20) DEFAULT '+94 77 123 4567',
        low_balance_threshold DECIMAL(10, 2) DEFAULT 300.00,
        daily_kwh_budget DECIMAL(10, 2) DEFAULT 12.00,
        auto_emergency_credit BOOLEAN DEFAULT TRUE,
        night_curfew_enabled BOOLEAN DEFAULT TRUE,
        email_notifications BOOLEAN DEFAULT TRUE,
        sms_notifications BOOLEAN DEFAULT TRUE,
        weekly_report BOOLEAN DEFAULT TRUE,
        tariff_type VARCHAR(100) DEFAULT 'Domestic D-1 (PUCSL Block Tariff)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
    `);
    console.log('Database tables initialized');

    // Phase 2 Security: Encrypt any legacy unhashed meter PINs using bcrypt
    const unhashedMeters = await pool.query(`SELECT id, pin FROM meters WHERE pin NOT LIKE '$2%'`);
    if (unhashedMeters.rows.length > 0) {
      const bcrypt = require('bcryptjs');
      for (const m of unhashedMeters.rows) {
        const hashed = await bcrypt.hash(m.pin, 10);
        await pool.query('UPDATE meters SET pin = $1 WHERE id = $2', [hashed, m.id]);
      }
      console.log(`[Security] Migrated ${unhashedMeters.rows.length} legacy meter PIN(s) to bcrypt cryptographic hashes.`);
    }

    // Seed default staff account if not exists
    const staffCheck = await pool.query(`SELECT id FROM users WHERE email = 'staff@leco.lk'`);
    if (staffCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const staffHash = await bcrypt.hash('staff123', 10);
      await pool.query(
        `INSERT INTO users (email, password, role) VALUES ('staff@leco.lk', $1, 'staff')`,
        [staffHash]
      );
      console.log('[Auth] Created default LECO staff account: staff@leco.lk (password: staff123)');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

const connectDb = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Connected to Neon PostgreSQL:', result.rows[0].now);
    await initDb();
  } catch (err) {
    console.error('Error connecting to database:', err.stack);
  }
};

module.exports = { pool, connectDb, initDb };
