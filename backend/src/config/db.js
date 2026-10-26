const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured before starting the backend.');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true
});

pool.on('error', (err) => {
  console.error('[Database Pool Warning]: Unexpected error on idle client:', err.message);
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
        emergency_credit_limit DECIMAL(10, 2) DEFAULT 500.00,
        emergency_credit_active BOOLEAN DEFAULT FALSE,
        emergency_credit_activated_at TIMESTAMP,
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
        type VARCHAR(50) NOT NULL,
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
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payhere_payment_id VARCHAR(100);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payhere_currency VARCHAR(10) DEFAULT 'LKR';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_holder_name VARCHAR(255);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_no VARCHAR(50);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'PayHere';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_notes TEXT;
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
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
    console.log('[Database] Tables and indexes verified successfully.');

    const bcrypt = require('bcryptjs');

    // Demo accounts are strictly for local development and must never be seeded in production.
    if (process.env.NODE_ENV === 'production') return;

    // 1. Seed / Verify Staff Account (staff@leco.lk / staff123)
    const staffCheck = await pool.query(`SELECT id FROM users WHERE email = 'staff@leco.lk'`);
    if (staffCheck.rows.length === 0) {
      const staffHash = await bcrypt.hash('staff123', 10);
      await pool.query(
        `INSERT INTO users (email, password, role) VALUES ('staff@leco.lk', $1, 'staff')`,
        [staffHash]
      );
      console.log('[Auth] Created default LECO Staff account: staff@leco.lk (password: staff123)');
    } else {
      // Ensure role is explicitly 'staff'
      await pool.query(`UPDATE users SET role = 'staff' WHERE email = 'staff@leco.lk'`);
    }

    // 2. Seed / Verify Customer Demo Account (customer@leco.lk / customer123)
    let customerId;
    const customerCheck = await pool.query(`SELECT id FROM users WHERE email = 'customer@leco.lk'`);
    if (customerCheck.rows.length === 0) {
      const custHash = await bcrypt.hash('customer123', 10);
      const custRes = await pool.query(
        `INSERT INTO users (email, password, role) VALUES ('customer@leco.lk', $1, 'customer') RETURNING id`,
        [custHash]
      );
      customerId = custRes.rows[0].id;
      console.log('[Auth] Created default LECO Customer account: customer@leco.lk (password: customer123)');
    } else {
      customerId = customerCheck.rows[0].id;
      await pool.query(`UPDATE users SET role = 'customer' WHERE email = 'customer@leco.lk'`);
    }

    // 3. Ensure Customer has at least one linked smart meter
    if (customerId) {
      const meterCheck = await pool.query(`SELECT id FROM meters WHERE user_id = $1`, [customerId]);
      if (meterCheck.rows.length === 0) {
        const pinHash = await bcrypt.hash('1234', 10);
        const newMeter = await pool.query(
          `INSERT INTO meters (user_id, meter_number, account_number, pin, balance, status, daily_average, name)
           VALUES ($1, 'LECO-COL-9901', 'ACC-883921', $2, 2450.00, 'Connected', 145.00, 'Primary Residence')
           RETURNING id`,
          [customerId, pinHash]
        );
        const meterId = newMeter.rows[0].id;

        // Seed 14 days of realistic consumption logs
        for (let i = 13; i >= 0; i--) {
          const kwh = +(8.5 + Math.random() * 6).toFixed(2);
          const exported = +(Math.random() * 2).toFixed(2);
          await pool.query(
            `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
             VALUES ($1, CURRENT_DATE - ($2 || ' days')::INTERVAL, 12, $3, $4)`,
            [meterId, i, kwh, exported]
          );
        }

        // Seed initial welcome notification
        await pool.query(
          `INSERT INTO notifications (user_id, meter_id, type, title, message)
           VALUES ($1, $2, 'info', 'Smart Meter Activated', 'Your smart meter LECO-COL-9901 has been linked to your account.')`,
          [customerId, meterId]
        );
        console.log('[Database] Seeded initial smart meter LECO-COL-9901 for customer@leco.lk');
      }
    }

    // 4. Migrate any unhashed legacy meter PINs
    const unhashedMeters = await pool.query(`SELECT id, pin FROM meters WHERE pin NOT LIKE '$2%'`);
    if (unhashedMeters.rows.length > 0) {
      for (const m of unhashedMeters.rows) {
        const hashed = await bcrypt.hash(m.pin, 10);
        await pool.query('UPDATE meters SET pin = $1 WHERE id = $2', [hashed, m.id]);
      }
      console.log(`[Security] Migrated ${unhashedMeters.rows.length} legacy meter PIN(s) to bcrypt hashes.`);
    }

  } catch (err) {
    console.error('[Database Init Error]:', err.message);
    throw err;
  }
};

const connectDb = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('[Database Connected] Neon PostgreSQL:', result.rows[0].now);
    await initDb();
  } catch (err) {
    console.error('[Database Connection Error]:', err.message);
    throw err;
  } finally {
    client?.release();
  }
};

module.exports = { pool, connectDb, initDb };
