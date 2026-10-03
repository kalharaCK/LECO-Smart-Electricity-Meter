const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { getWalletLifetimePrediction } = require('../services/predictionEngine');
const { calculateDomesticBill } = require('../services/tariffEngine');
const { sanitizeString } = require('../middlewares/sanitizer');
const { emitMeterUpdate, emitNotification } = require('../services/socketService');

/**
 * Broadcasts latest meter telemetry, balance, and prediction over WebSocket
 * @param {number|string} meterId 
 */
async function broadcastMeterState(meterId) {
  try {
    const meterRow = await pool.query(
      `SELECT id, user_id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active 
       FROM meters WHERE id = $1`,
      [meterId]
    );
    if (meterRow.rows.length === 0) return null;
    const meter = meterRow.rows[0];
    const balance = parseFloat(meter.balance);
    const limit = parseFloat(meter.emergency_credit_limit || 500);

    const todayResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date = CURRENT_DATE`,
      [meterId]
    );
    const yesterdayResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date = CURRENT_DATE - INTERVAL '1 day'`,
      [meterId]
    );
    const weekResult = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export FROM consumption_logs WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [meterId]
    );
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
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyResult.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      })),
      emergencyCreditLimit: limit,
      emergencyCreditActive: meter.emergency_credit_active
    });

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

    const payload = {
      meterId: Number(meterId),
      balance: balance,
      status: meter.status,
      emergency_credit_active: meter.emergency_credit_active,
      emergency_credit_limit: limit,
      today: parseFloat(todayResult.rows[0]?.total_import || 0).toFixed(1),
      exportToday: parseFloat(todayResult.rows[0]?.total_export || 0).toFixed(1),
      yesterday: parseFloat(yesterdayResult.rows[0]?.total_import || 0).toFixed(1),
      exportYesterday: parseFloat(yesterdayResult.rows[0]?.total_export || 0).toFixed(1),
      thisWeek: parseFloat(weekResult.rows[0]?.total_import || 0).toFixed(1),
      exportThisWeek: parseFloat(weekResult.rows[0]?.total_export || 0).toFixed(1),
      currentPower: (Math.random() * 1.5 + 0.5).toFixed(2),
      currentExport: (new Date().getHours() >= 8 && new Date().getHours() <= 17) ? (Math.random() * 2.0).toFixed(2) : '0.00',
      chartData: chartResult.rows.map(r => ({
        date: r.date,
        import: parseFloat(r.import || 0),
        export: parseFloat(r.export || 0)
      })),
      prediction,
      timestamp: new Date().toISOString()
    };

    emitMeterUpdate(meterId, payload);
    return payload;
  } catch (err) {
    console.error('Error in broadcastMeterState:', err);
    return null;
  }
}

const getUserMeters = async (req, res) => {
  try {
    const userId = req.user.id;
    // Exclude sensitive cryptographic pin hash from client responses
    const result = await pool.query(
      `SELECT id, user_id, meter_number, account_number, balance, status, daily_average, name, 
              emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at, created_at 
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
    const { meterNumber, accountNumber, pin, name } = req.body;

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
      const meterName = sanitizeString(name || existingMeter.name || 'Home', 100);
      const linkResult = await pool.query(
        `UPDATE meters 
         SET user_id = $1, account_number = COALESCE($2, account_number), name = $3 
         WHERE id = $4 
         RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, 
                   emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at, created_at`,
        [userId, accountNumber, meterName, existingMeter.id]
      );

      return res.status(200).json({ message: 'Meter linked successfully', meter: linkResult.rows[0] });
    }

    // If meter does not exist yet (self-provisioning / seed in database):
    // Cryptographically hash the PIN with a one-way salt using bcrypt (10 rounds)
    const hashedPin = await bcrypt.hash(String(pin), 10);

    const initialBalance = 1850.00;
    const dailyAvg = 220.00;
    const meterName = sanitizeString(name || 'Home', 100);

    const result = await pool.query(
      `INSERT INTO meters (user_id, meter_number, account_number, pin, balance, daily_average, name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, 
                 emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at, created_at`,
      [userId, meterNumber, accountNumber, hashedPin, initialBalance, dailyAvg, meterName]
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

    const meterRow = await pool.query('SELECT balance, emergency_credit_limit, emergency_credit_active FROM meters WHERE id = $1', [meterId]);
    const balance = parseFloat(meterRow.rows[0]?.balance || 0);
    const emergencyCreditLimit = parseFloat(meterRow.rows[0]?.emergency_credit_limit || 500);
    const emergencyCreditActive = Boolean(meterRow.rows[0]?.emergency_credit_active);

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyResult.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      })),
      emergencyCreditLimit,
      emergencyCreditActive
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
    const meterCheck = await pool.query(
      'SELECT id, balance, emergency_credit_limit, emergency_credit_active FROM meters WHERE id = $1 AND user_id = $2',
      [meterId, req.user.id]
    );
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
      })),
      emergencyCreditLimit: parseFloat(meterCheck.rows[0].emergency_credit_limit || 500),
      emergencyCreditActive: Boolean(meterCheck.rows[0].emergency_credit_active)
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
        `SELECT id, balance, meter_number, emergency_credit_active, emergency_credit_limit 
         FROM meters 
         WHERE id = $1 AND user_id = $2 FOR UPDATE`,
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

      // Lifeline Debt Recovery:
      const hadNegativeDebt = prevBalance < 0;
      const debtRecovered = hadNegativeDebt ? Math.min(rechargeAmount, Math.abs(prevBalance)) : 0;
      const wasLifelineActive = Boolean(meterCheck.rows[0].emergency_credit_active);
      const shouldDeactivateLifeline = wasLifelineActive && newBalance >= 0;

      // Update meter balance & deactivate lifeline if debt cleared
      await client.query(
        `UPDATE meters 
         SET balance = $1,
             status = 'Connected',
             emergency_credit_active = CASE WHEN $2 = TRUE THEN FALSE ELSE emergency_credit_active END
         WHERE id = $3`,
        [newBalance.toFixed(2), shouldDeactivateLifeline, meterId]
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

      // Insert payment success notification with debt recovery context
      let notificationMsg = `Rs. ${rechargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} credited to meter ${meterCheck.rows[0].meter_number}. New balance: Rs. ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Ref: ${txnId}`;
      if (debtRecovered > 0) {
        notificationMsg = `Rs. ${rechargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} recharge completed. Rs. ${debtRecovered.toFixed(2)} negative lifeline debt automatically recovered. Net available balance: Rs. ${newBalance.toFixed(2)}. Emergency Credit replenished! Ref: ${txnId}`;
      }

      await client.query(
        `INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`,
        [userId, meterId, 'success', 'Recharge Successful', notificationMsg]
      );

      await client.query('COMMIT');

      // Real-time WebSocket Broadcast
      broadcastMeterState(meterId).catch(e => console.error('WS broadcast error:', e));

      res.status(200).json({
        message: debtRecovered > 0 
          ? `Recharge successful. Recovered Rs. ${debtRecovered.toFixed(2)} emergency credit debt.` 
          : 'Recharge successful',
        prevBalance: prevBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
        amount: rechargeAmount.toFixed(2),
        debtRecovered: debtRecovered.toFixed(2),
        lifelineReplenished: shouldDeactivateLifeline,
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

const updateMeterName = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Valid meter name is required' });
    }

    const cleanName = sanitizeString(name, 100);
    if (!cleanName) {
      return res.status(400).json({ message: 'Meter name cannot be blank or solely HTML tags' });
    }

    const result = await pool.query(
      `UPDATE meters 
       SET name = $1 
       WHERE id = $2 AND user_id = $3 
       RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, created_at`,
      [cleanName, meterId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Meter not found or unauthorized' });
    }

    res.json({ message: 'Meter name updated successfully', meter: result.rows[0] });
  } catch (error) {
    console.error('Error updating meter name:', error);
    res.status(500).json({ message: 'Server error updating meter name' });
  }
};

const activateEmergencyCredit = async (req, res) => {
  try {
    const { meterId } = req.params;
    const userId = req.user.id;

    const meterRes = await pool.query(
      `SELECT id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active 
       FROM meters 
       WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );

    if (meterRes.rows.length === 0) {
      return res.status(404).json({ message: 'Meter not found or access denied' });
    }

    const meter = meterRes.rows[0];
    const balance = parseFloat(meter.balance || 0);
    const limit = parseFloat(meter.emergency_credit_limit || 500.00);

    if (meter.emergency_credit_active) {
      return res.status(400).json({ 
        message: 'Emergency credit (Lifeline Mode) is already active for this meter',
        isLifelineActive: true,
        limit,
        balance
      });
    }

    // Emergency credit can be activated if balance is <= Rs. 100 or already depleted/negative
    if (balance > 100) {
      return res.status(400).json({ 
        message: `Emergency credit can only be activated when balance drops below Rs. 100. Current balance: Rs. ${balance.toFixed(2)}.` 
      });
    }

    // If balance is already below the negative limit (e.g. <= -500), cannot activate
    if (balance <= -limit) {
      return res.status(400).json({ 
        message: `Maximum emergency credit limit of Rs. ${limit.toFixed(2)} has been reached. Please recharge to restore service.` 
      });
    }

    // Activate Lifeline Mode
    const updateResult = await pool.query(
      `UPDATE meters 
       SET emergency_credit_active = TRUE, 
           emergency_credit_activated_at = CURRENT_TIMESTAMP,
           status = 'Connected'
       WHERE id = $1 
       RETURNING id, user_id, meter_number, account_number, balance, status, daily_average, name, 
                 emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at, created_at`,
      [meterId]
    );

    const updatedMeter = updateResult.rows[0];

    // Notification
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        meterId,
        'info',
        'Lifeline Mode Activated',
        `Emergency Credit of Rs. ${limit.toFixed(2)} is now active for meter ${meter.meter_number}. Power will remain connected up to -Rs. ${limit.toFixed(2)}. The negative debt will be recovered upon next recharge.`
      ]
    );

    // Real-time WebSocket Broadcast
    broadcastMeterState(meterId).catch(e => console.error('WS broadcast error:', e));

    res.json({
      message: `Emergency credit of Rs. ${limit.toFixed(2)} activated! Power will remain connected.`,
      meter: updatedMeter
    });
  } catch (error) {
    console.error('Error activating emergency credit:', error);
    res.status(500).json({ message: 'Server error activating emergency credit' });
  }
};

/**
 * Simulate electricity consumption on a meter.
 * Calculates cost using PUCSL tariffs, deducts from prepaid balance,
 * respects Lifeline Mode, and inserts telemetry into consumption_logs.
 */
const simulateConsumption = async (req, res) => {
  try {
    const { meterId } = req.params;
    const userId = req.user.id;
    const kwh = parseFloat(req.body.kwh);
    const exportKwh = parseFloat(req.body.exportKwh || 0);

    if (isNaN(kwh) || kwh <= 0) {
      return res.status(400).json({ message: 'Valid positive kWh consumption is required (e.g. 1.0, 5.0)' });
    }

    // Verify ownership
    const meterQuery = await pool.query(
      `SELECT id, user_id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active
       FROM meters WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );

    if (meterQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Meter not found or access denied' });
    }

    const meter = meterQuery.rows[0];
    const prevBalance = parseFloat(meter.balance);
    const limit = parseFloat(meter.emergency_credit_limit || 500);

    // Calculate energy cost using official PUCSL block tariff for current month
    const monthResult = await pool.query(
      `SELECT COALESCE(SUM(consumption), 0) as month_kwh 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );
    const currentMonthKwh = parseFloat(monthResult.rows[0]?.month_kwh || 0);
    const billBefore = calculateDomesticBill(currentMonthKwh);
    const billAfter = calculateDomesticBill(currentMonthKwh + kwh);
    let energyCost = Math.round((billAfter.energyCharge - billBefore.energyCharge) * 100) / 100;
    if (energyCost <= 0) {
      energyCost = Math.round(kwh * 9.0 * 100) / 100; // fallback base energy rate
    }

    // Deduct cost from balance
    const newBalance = Math.round((prevBalance - energyCost) * 100) / 100;

    // Evaluate connection status and lifeline protection
    let newStatus = meter.status;
    let disconnected = false;

    if (newBalance <= 0) {
      if (meter.emergency_credit_active) {
        if (newBalance < -limit) {
          newStatus = 'Disconnected';
          disconnected = true;
        } else {
          newStatus = 'Connected'; // Protected by Lifeline Mode
        }
      } else {
        newStatus = 'Disconnected';
        disconnected = true;
      }
    } else {
      newStatus = 'Connected';
    }

    // Record consumption telemetry for current hour
    const currentHour = new Date().getHours();
    await pool.query(
      `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
      [meterId, currentHour, kwh, exportKwh]
    );

    // Update meter balance & status
    await pool.query(
      `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
      [newBalance, newStatus, meterId]
    );

    // Notification alerts
    if (disconnected && meter.status !== 'Disconnected') {
      await pool.query(
        `INSERT INTO notifications (user_id, meter_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          meterId,
          'alert',
          'Power Disconnected (Zero Balance)',
          meter.emergency_credit_active
            ? `Emergency credit buffer of Rs. ${limit.toFixed(2)} has been exhausted (Balance: Rs. ${newBalance.toFixed(2)}). Power disconnected. Please recharge immediately.`
            : `Prepaid balance exhausted (Rs. ${newBalance.toFixed(2)}). Power disconnected. Please recharge or activate Lifeline Emergency Credit.`
        ]
      );
    } else if (newBalance <= 100 && prevBalance > 100 && !meter.emergency_credit_active) {
      await pool.query(
        `INSERT INTO notifications (user_id, meter_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          meterId,
          'alert',
          'Low Balance Alert',
          `Your balance has dropped to Rs. ${newBalance.toFixed(2)}. You are now eligible to activate Emergency Credit (Lifeline Mode).`
        ]
      );
    }

    // Real-time WebSocket Broadcast (instantly notifies frontend without full page reload)
    const livePayload = await broadcastMeterState(meterId);

    res.json({
      message: `Simulated ${kwh} kWh consumed. Deducted Rs. ${energyCost.toFixed(2)} from prepaid balance.`,
      kwhAdded: kwh,
      costDeducted: energyCost,
      prevBalance,
      newBalance,
      status: newStatus,
      isLifelineActive: meter.emergency_credit_active,
      disconnected,
      livePayload
    });
  } catch (error) {
    console.error('Error simulating consumption:', error);
    res.status(500).json({ message: 'Server error simulating consumption' });
  }
};

/**
 * Set meter balance directly for testing/demonstration purposes.
 */
const setMeterBalance = async (req, res) => {
  try {
    const { meterId } = req.params;
    const userId = req.user.id;
    const targetBalance = parseFloat(req.body.balance);

    if (isNaN(targetBalance)) {
      return res.status(400).json({ message: 'Valid balance number required' });
    }

    const meterQuery = await pool.query(
      `SELECT id, user_id, status, emergency_credit_active, emergency_credit_limit FROM meters WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );
    if (meterQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Meter not found or access denied' });
    }

    const meter = meterQuery.rows[0];
    const limit = parseFloat(meter.emergency_credit_limit || 500);
    let status = 'Connected';
    if (targetBalance <= 0) {
      if (!meter.emergency_credit_active || targetBalance < -limit) {
        status = 'Disconnected';
      }
    }

    await pool.query(
      `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
      [targetBalance, status, meterId]
    );

    // Real-time WebSocket Broadcast
    broadcastMeterState(meterId).catch(e => console.error('WS broadcast error:', e));

    res.json({
      message: `Meter balance set to Rs. ${targetBalance.toFixed(2)}`,
      newBalance: targetBalance,
      status
    });
  } catch (error) {
    console.error('Error setting meter balance:', error);
    res.status(500).json({ message: 'Server error setting meter balance' });
  }
};

/**
 * Staff API: Get all meters with comprehensive telemetry, consumption, customer, and complaint status
 * GET /api/meters/all
 */
const getAllMetersForStaff = async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id,
        m.meter_number,
        m.account_number,
        m.name,
        m.balance,
        m.status,
        m.emergency_credit_limit,
        m.emergency_credit_active,
        m.emergency_credit_activated_at,
        m.created_at,
        u.id AS customer_id,
        u.email AS customer_email,
        u.role AS customer_role,
        u.created_at AS customer_since,
        COALESCE(us.phone_number, '+94 77 123 4567') AS phone_number,
        COALESCE(us.tariff_type, 'Domestic D-1 (PUCSL Block Tariff)') AS tariff_type,
        COALESCE(us.low_balance_threshold, 300.00) AS low_balance_threshold,
        COALESCE(us.daily_kwh_budget, 12.00) AS daily_kwh_budget,
        COALESCE(today_c.today_consumption, 0) AS today_kwh,
        COALESCE(total_c.total_consumption, 0) AS total_kwh,
        COALESCE(complaints_cnt.open_complaints, 0) AS open_complaints_count,
        COALESCE(last_pay.last_payment_amount, 0) AS last_payment_amount,
        last_pay.last_payment_date
      FROM meters m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN (
        SELECT meter_id, ROUND(SUM(consumption)::numeric, 2) AS today_consumption
        FROM consumption_logs
        WHERE reading_date = CURRENT_DATE
        GROUP BY meter_id
      ) today_c ON today_c.meter_id = m.id
      LEFT JOIN (
        SELECT meter_id, ROUND(SUM(consumption)::numeric, 2) AS total_consumption
        FROM consumption_logs
        GROUP BY meter_id
      ) total_c ON total_c.meter_id = m.id
      LEFT JOIN (
        SELECT meter_id, COUNT(*) AS open_complaints
        FROM complaints
        WHERE status IN ('submitted', 'in_review', 'investigating')
        GROUP BY meter_id
      ) complaints_cnt ON complaints_cnt.meter_id = m.id
      LEFT JOIN (
        SELECT DISTINCT ON (meter_id) 
          meter_id, 
          amount AS last_payment_amount, 
          created_at AS last_payment_date
        FROM payments
        ORDER BY meter_id, created_at DESC
      ) last_pay ON last_pay.meter_id = m.id
      ORDER BY m.id ASC
    `;
    const result = await pool.query(query);
    return res.json({
      success: true,
      meters: result.rows
    });
  } catch (error) {
    console.error('Error fetching all meters for staff:', error);
    return res.status(500).json({ success: false, message: 'Failed to load meters for staff.' });
  }
};

/**
 * Staff API: Remotely toggle physical relay state (Connect / Disconnect)
 * POST /api/meters/:meterId/toggle-relay
 */
const toggleMeterRelay = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { action, reason } = req.body; // action: 'Connected' | 'Disconnected'

    const check = await pool.query('SELECT * FROM meters WHERE id = $1', [meterId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meter not found.' });
    }
    const meter = check.rows[0];
    const newStatus = action || (meter.status === 'Connected' ? 'Disconnected' : 'Connected');

    await pool.query('UPDATE meters SET status = $1 WHERE id = $2', [newStatus, meterId]);

    // Insert alert notification to customer
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        meter.user_id,
        meterId,
        newStatus === 'Connected' ? 'success' : 'alert',
        `Grid Relay Status: ${newStatus}`,
        reason || `LECO Grid Control Center has set your meter ${meter.meter_number} to ${newStatus}.`
      ]
    );

    // Broadcast to real-time WebSockets
    broadcastMeterState(meterId).catch(console.error);

    return res.json({
      success: true,
      message: `Meter relay successfully changed to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error toggling meter relay:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle relay.' });
  }
};

/**
 * Staff API: Manual emergency top-up / credit relief override
 * POST /api/meters/:meterId/staff-topup
 */
const staffTopupMeter = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { amount, reason } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid top-up amount required.' });
    }

    const check = await pool.query('SELECT * FROM meters WHERE id = $1', [meterId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meter not found.' });
    }
    const meter = check.rows[0];
    const prevBalance = parseFloat(meter.balance);
    const newBalance = prevBalance + numAmount;
    const newStatus = newBalance > 0 ? 'Connected' : meter.status;

    await pool.query(
      'UPDATE meters SET balance = $1, status = $2 WHERE id = $3',
      [newBalance, newStatus, meterId]
    );

    const txId = 'STAFF-RELIEF-' + Date.now();
    await pool.query(
      `INSERT INTO payments (user_id, meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
       VALUES ($1, $2, $3, 'Staff Manual Relief', $4, $5, $6, 'Success')`,
      [meter.user_id, meterId, numAmount, txId, prevBalance, newBalance]
    );

    // Notify user
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, 'success', 'Staff Credit Adjustment', $3)`,
      [
        meter.user_id,
        meterId,
        `LECO Staff credited Rs. ${numAmount.toFixed(2)} to meter ${meter.meter_number}. ${reason ? 'Reason: ' + reason : ''}`
      ]
    );

    broadcastMeterState(meterId).catch(console.error);

    return res.json({
      success: true,
      message: `Credited Rs. ${numAmount.toFixed(2)} to meter ${meter.meter_number}.`,
      newBalance,
      status: newStatus
    });
  } catch (err) {
    console.error('Error in staff topup:', err);
    return res.status(500).json({ success: false, message: 'Failed to process staff topup.' });
  }
};

module.exports = { 
  getUserMeters, 
  addMeter, 
  getMeterConsumption, 
  getMeterPrediction, 
  rechargeMeter, 
  getPaymentHistory,
  updateMeterName,
  activateEmergencyCredit,
  simulateConsumption,
  setMeterBalance,
  getAllMetersForStaff,
  toggleMeterRelay,
  staffTopupMeter
};
