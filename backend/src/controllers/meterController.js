const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { getWalletLifetimePrediction } = require('../services/predictionEngine');
const { calculateDomesticBill } = require('../services/tariffEngine');

const getUserMeters = async (req, res) => {
  try {
    const userId = req.user.id;
    // Exclude sensitive cryptographic pin hash from client responses
    const result = await pool.query(
      `SELECT id, user_id, meter_number, account_number, balance, status, daily_average, name, created_at 
       FROM meters 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meters:', error);
    res.status(500).json({ message: 'Server error fetching meters' });
  }
};

const addMeter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meterNumber, accountNumber, pin } = req.body;

    if (!meterNumber || !accountNumber || !pin) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Step 2 Security: Cryptographic PIN Verification & Hashing
    // Check if meter was already provisioned/manufactured in the database
    const existingMeterResult = await pool.query('SELECT * FROM meters WHERE meter_number = $1', [meterNumber]);

    if (existingMeterResult.rows.length > 0) {
      const existingMeter = existingMeterResult.rows[0];

      // Cryptographic comparison: compare user-supplied plaintext PIN with stored bcrypt hash
      const isPinValid = await bcrypt.compare(String(pin), existingMeter.pin);
      if (!isPinValid) {
        return res.status(401).json({ message: 'Invalid Meter PIN. Verification failed.' });
      }

      // Check if already claimed by another user
      if (existingMeter.user_id && existingMeter.user_id !== userId) {
        return res.status(400).json({ message: 'This meter is already linked to another account' });
      }

      if (existingMeter.user_id === userId) {
        return res.status(400).json({ message: 'Meter is already linked to your account' });
      }

      // Link unassigned meter to the requesting user (never returning pin)
      const linkResult = await pool.query(
        `UPDATE meters 
         SET user_id = $1, account_number = COALESCE($2, account_number) 
         WHERE id = $3 
         RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, created_at`,
        [userId, accountNumber, existingMeter.id]
      );

      return res.status(200).json({ message: 'Meter linked successfully', meter: linkResult.rows[0] });
    }

    // If meter does not exist yet (self-provisioning / seed in database):
    // Cryptographically hash the PIN with a one-way salt using bcrypt (10 rounds)
    const hashedPin = await bcrypt.hash(String(pin), 10);

    const initialBalance = 1850.00;
    const dailyAvg = 220.00;

    const result = await pool.query(
      `INSERT INTO meters (user_id, meter_number, account_number, pin, balance, daily_average, name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, created_at`,
      [userId, meterNumber, accountNumber, hashedPin, initialBalance, dailyAvg, 'Home']
    );

    const newMeter = result.rows[0];

    // Seed mock consumption data for the past 30 days
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const today = new Date();
      const rows = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // 24 hours of data - realistic Sri Lankan domestic household (avg ~4.5 kWh/day)
        for (let h = 0; h < 24; h++) {
          const baseHour = (h >= 23 || h < 6) ? 0.08 : (h >= 18 && h <= 22) ? 0.28 : 0.18;
          const consumption = Math.max(0.02, baseHour + (Math.random() * 0.1 - 0.05)).toFixed(2);
          let energyExport = '0.00';
          if (h >= 9 && h <= 16) {
            energyExport = (Math.random() * 0.25 + 0.10).toFixed(2);
          }
          rows.push({ dateStr, h, consumption, energyExport });
        }
      }

      // Ultra-fast single-roundtrip batch insert via PostgreSQL UNNEST
      await client.query(
        `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
         SELECT $1, unnest($2::date[]), unnest($3::int[]), unnest($4::numeric[]), unnest($5::numeric[])`,
        [
          newMeter.id,
          rows.map(r => r.dateStr),
          rows.map(r => r.h),
          rows.map(r => r.consumption),
          rows.map(r => r.energyExport)
        ]
      );
      await client.query('COMMIT');

      // Seed mock notifications
      await client.query('BEGIN');
      await client.query(`INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`, [userId, newMeter.id, 'success', 'Meter Connected', `Smart meter ${meterNumber} has been successfully connected to your account.`]);
      await client.query(`INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`, [userId, newMeter.id, 'alert', 'Low Balance Warning', `Your balance is below Rs. 2,000. Consider recharging soon.`]);
      await client.query(`INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`, [userId, newMeter.id, 'info', 'High Export Detected', `You had a peak solar export of 1.8 kW yesterday.`]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Failed to seed data:', e);
    } finally {
      client.release();
    }

    res.status(201).json({ message: 'Meter added successfully', meter: newMeter });
  } catch (error) {
    console.error('Error adding meter:', error);
    // Handle unique violation for meter_number if already exists
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Meter is already registered' });
    }
    res.status(500).json({ message: 'Server error adding meter' });
  }
};

const getMeterConsumption = async (req, res) => {
  try {
    const { meterId } = req.params;
    
    // Validate that this meter belongs to the user
    const meterCheck = await pool.query('SELECT id FROM meters WHERE id = $1 AND user_id = $2', [meterId, req.user.id]);
    if (meterCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get today's total
    const todayResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date = CURRENT_DATE`,
      [meterId]
    );
    
    // Get yesterday's total
    const yesterdayResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date = CURRENT_DATE - INTERVAL '1 day'`,
      [meterId]
    );

    // Get this week's total (last 7 days)
    const weekResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [meterId]
    );

    // Get last week's total (days 8-14)
    const lastWeekResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '14 days' AND reading_date < CURRENT_DATE - INTERVAL '7 days'`,
      [meterId]
    );

    // Get this month's total
    const monthResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    // Get daily data for the last 7 days for the chart
    const chartResult = await pool.query(
      `SELECT 
         to_char(reading_date, 'Mon DD') as date,
         SUM(consumption) as import,
         SUM(energy_export) as export
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY reading_date
       ORDER BY reading_date ASC`,
      [meterId]
    );

    // Get current power (just use the latest hour reading or mock based on time)
    const currentPower = (Math.random() * 1.5 + 0.5).toFixed(2); // Mock current kW draw
    const currentExport = (new Date().getHours() >= 8 && new Date().getHours() <= 17) ? (Math.random() * 2.0).toFixed(2) : '0.00';

    // Fetch daily history for LECO wallet lifetime prediction (Net consumption: Import - Export)
    const historyResult = await pool.query(
      `SELECT 
         reading_date::text as date,
         GREATEST(0, SUM(consumption) - SUM(energy_export)) as consumption,
         EXTRACT(DOW FROM reading_date)::int as day_of_week
       FROM consumption_logs
       WHERE meter_id = $1
       GROUP BY reading_date
       ORDER BY reading_date DESC
       LIMIT 60`,
      [meterId]
    );

    // Fetch cycle net consumption (since start of current billing month)
    const cycleResult = await pool.query(
      `SELECT GREATEST(0, COALESCE(SUM(consumption) - SUM(energy_export), 0)) as cycle_net 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    const meterRow = await pool.query('SELECT balance FROM meters WHERE id = $1', [meterId]);
    const balance = parseFloat(meterRow.rows[0]?.balance || 0);

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyResult.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      }))
    });

    res.json({
      today: parseFloat(todayResult.rows[0].total_import || 0).toFixed(1),
      yesterday: parseFloat(yesterdayResult.rows[0].total_import || 0).toFixed(1),
      thisWeek: parseFloat(weekResult.rows[0].total_import || 0).toFixed(1),
      lastWeek: parseFloat(lastWeekResult.rows[0].total_import || 0).toFixed(1),
      thisMonth: parseFloat(monthResult.rows[0].total_import || 0).toFixed(1),
      
      exportToday: parseFloat(todayResult.rows[0].total_export || 0).toFixed(1),
      exportYesterday: parseFloat(yesterdayResult.rows[0].total_export || 0).toFixed(1),
      exportThisWeek: parseFloat(weekResult.rows[0].total_export || 0).toFixed(1),
      exportLastWeek: parseFloat(lastWeekResult.rows[0].total_export || 0).toFixed(1),
      exportThisMonth: parseFloat(monthResult.rows[0].total_export || 0).toFixed(1),
      
      currentPower: currentPower,
      currentExport: currentExport,
      
      prediction: prediction,

      chartData: chartResult.rows.map(row => ({
        date: row.date,
        import: parseFloat(row.import || 0).toFixed(1),
        export: parseFloat(row.export || 0).toFixed(1),
        net: (parseFloat(row.import || 0) - parseFloat(row.export || 0)).toFixed(1)
      }))
    });
  } catch (error) {
    console.error('Error fetching consumption:', error);
    res.status(500).json({ message: 'Server error fetching consumption' });
  }
};

const getMeterPrediction = async (req, res) => {
  try {
    const { meterId } = req.params;
    const meterCheck = await pool.query('SELECT id, balance FROM meters WHERE id = $1 AND user_id = $2', [meterId, req.user.id]);
    if (meterCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const historyResult = await pool.query(
      `SELECT 
         reading_date::text as date,
         GREATEST(0, SUM(consumption) - SUM(energy_export)) as consumption,
         EXTRACT(DOW FROM reading_date)::int as day_of_week
       FROM consumption_logs
       WHERE meter_id = $1
       GROUP BY reading_date
       ORDER BY reading_date DESC
       LIMIT 60`,
      [meterId]
    );

    const cycleResult = await pool.query(
      `SELECT GREATEST(0, COALESCE(SUM(consumption) - SUM(energy_export), 0)) as cycle_net 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    const prediction = getWalletLifetimePrediction({
      walletBalance: parseFloat(meterCheck.rows[0].balance || 0),
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyResult.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      }))
    });

    res.json(prediction);
  } catch (error) {
    console.error('Error calculating meter prediction:', error);
    res.status(500).json({ message: 'Server error calculating prediction' });
  }
};

const rechargeMeter = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { amount, paymentMethod } = req.body;
    const userId = req.user.id;
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey;

    if (!amount || isNaN(amount) || parseFloat(amount) < 100) {
      return res.status(400).json({ message: 'Minimum recharge amount is Rs. 100' });
    }

    // Step 1: Idempotency Check - prevent double-charges from network lag or multiple clicks
    if (idempotencyKey) {
      const existingPayment = await pool.query(
        `SELECT p.*, m.meter_number 
         FROM payments p 
         JOIN meters m ON p.meter_id = m.id 
         WHERE (p.idempotency_key = $1 OR p.transaction_id = $1) AND p.user_id = $2`,
        [idempotencyKey, userId]
      );

      if (existingPayment.rows.length > 0) {
        const row = existingPayment.rows[0];
        console.log(`[Idempotency] Duplicate request intercepted for key: ${idempotencyKey}. Returning previous result without double-charging.`);
        return res.status(200).json({
          message: 'Recharge already processed (idempotent)',
          prevBalance: parseFloat(row.previous_balance).toFixed(2),
          newBalance: parseFloat(row.new_balance).toFixed(2),
          amount: parseFloat(row.amount).toFixed(2),
          paymentMethod: row.payment_method,
          txnId: row.transaction_id,
          idempotencyKey: row.idempotency_key,
          isIdempotentReplay: true
        });
      }
    }

    // Connect client for atomic database transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership with row-level lock (FOR UPDATE)
      const meterCheck = await client.query(
        'SELECT id, balance, meter_number FROM meters WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [meterId, userId]
      );
      if (meterCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access denied' });
      }

      const prevBalance = parseFloat(meterCheck.rows[0].balance);
      const rechargeAmount = parseFloat(amount);
      const newBalance = prevBalance + rechargeAmount;
      const method = paymentMethod || 'card';

      // Update meter balance
      await client.query(
        'UPDATE meters SET balance = $1 WHERE id = $2',
        [newBalance.toFixed(2), meterId]
      );

      // Generate consistent transaction ID linked to idempotency key
      const shortKey = idempotencyKey ? idempotencyKey.replace(/-/g, '').slice(0, 8).toUpperCase() : Date.now().toString().slice(-6);
      const txnId = `TXN-${shortKey}-${Date.now().toString().slice(-4)}`;

      // Record in payments table with idempotency_key
      await client.query(
        `INSERT INTO payments (user_id, meter_id, amount, payment_method, transaction_id, idempotency_key, previous_balance, new_balance, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, meterId, rechargeAmount, method, txnId, idempotencyKey || null, prevBalance.toFixed(2), newBalance.toFixed(2), 'Success']
      );

      // Insert payment success notification
      await client.query(
        `INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`,
        [
          userId, meterId, 'success',
          'Recharge Successful',
          `Rs. ${rechargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} credited to meter ${meterCheck.rows[0].meter_number}. New balance: Rs. ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Ref: ${txnId}`
        ]
      );

      await client.query('COMMIT');

      res.status(200).json({
        message: 'Recharge successful',
        prevBalance: prevBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
        amount: rechargeAmount.toFixed(2),
        paymentMethod: method,
        txnId,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      
      // Handle rare concurrent race condition where duplicate key constraint triggers
      if (err.code === '23505' && idempotencyKey) {
        const existing = await pool.query(
          `SELECT p.* FROM payments p WHERE p.idempotency_key = $1 AND p.user_id = $2`,
          [idempotencyKey, userId]
        );
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          return res.status(200).json({
            message: 'Recharge already processed (idempotent)',
            prevBalance: parseFloat(row.previous_balance).toFixed(2),
            newBalance: parseFloat(row.new_balance).toFixed(2),
            amount: parseFloat(row.amount).toFixed(2),
            paymentMethod: row.payment_method,
            txnId: row.transaction_id,
            isIdempotentReplay: true
          });
        }
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error recharging meter:', error);
    res.status(500).json({ message: 'Server error during recharge' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meterId } = req.query;

    let query = `
      SELECT 
        p.*,
        m.meter_number,
        m.name as meter_name
      FROM payments p
      JOIN meters m ON p.meter_id = m.id
      WHERE p.user_id = $1
    `;
    const params = [userId];

    if (meterId) {
      query += ` AND p.meter_id = $2`;
      params.push(meterId);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error fetching payment history' });
  }
};

module.exports = { getUserMeters, addMeter, getMeterConsumption, getMeterPrediction, rechargeMeter, getPaymentHistory };
