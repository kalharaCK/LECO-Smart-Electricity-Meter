const { pool } = require('../config/db');
const { getWalletLifetimePrediction } = require('../services/predictionEngine');
const { calculateDomesticBill } = require('../services/tariffEngine');

const getUserMeters = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM meters WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
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

    // For prototype, we will just create a new meter entry for the user
    // Give it a dummy balance so they see something interesting on the dashboard
    const initialBalance = 1850.00;
    const dailyAvg = 220.00;

    const result = await pool.query(
      `INSERT INTO meters (user_id, meter_number, account_number, pin, balance, daily_average, name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, meterNumber, accountNumber, pin, initialBalance, dailyAvg, 'Home']
    );

    const newMeter = result.rows[0];

    // Seed mock consumption data for the past 30 days
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // 24 hours of data
        for (let h = 0; h < 24; h++) {
          // random consumption between 0.1 and 1.5 kWh
          const consumption = (Math.random() * 1.4 + 0.1).toFixed(2);
          // random export (e.g., solar generation) during daytime (8 AM to 5 PM)
          let energyExport = '0.00';
          if (h >= 8 && h <= 17) {
            energyExport = (Math.random() * 2.0).toFixed(2);
          }
          await client.query(
            `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export) VALUES ($1, $2, $3, $4, $5)`,
            [newMeter.id, dateStr, h, consumption, energyExport]
          );
        }
      }
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

    // Fetch daily history for LECO wallet lifetime prediction
    const historyResult = await pool.query(
      `SELECT 
         reading_date::text as date,
         SUM(consumption) as consumption,
         EXTRACT(DOW FROM reading_date)::int as day_of_week
       FROM consumption_logs
       WHERE meter_id = $1
       GROUP BY reading_date
       ORDER BY reading_date DESC
       LIMIT 60`,
      [meterId]
    );

    // Fetch cycle consumption (last 30 days)
    const cycleResult = await pool.query(
      `SELECT COALESCE(SUM(consumption), 0) as cycle_import 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '29 days'`,
      [meterId]
    );

    const meterRow = await pool.query('SELECT balance FROM meters WHERE id = $1', [meterId]);
    const balance = parseFloat(meterRow.rows[0]?.balance || 0);

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_import || 0),
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
         SUM(consumption) as consumption,
         EXTRACT(DOW FROM reading_date)::int as day_of_week
       FROM consumption_logs
       WHERE meter_id = $1
       GROUP BY reading_date
       ORDER BY reading_date DESC
       LIMIT 60`,
      [meterId]
    );

    const cycleResult = await pool.query(
      `SELECT COALESCE(SUM(consumption), 0) as cycle_import 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '29 days'`,
      [meterId]
    );

    const prediction = getWalletLifetimePrediction({
      walletBalance: parseFloat(meterCheck.rows[0].balance || 0),
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_import || 0),
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

    if (!amount || isNaN(amount) || parseFloat(amount) < 100) {
      return res.status(400).json({ message: 'Minimum recharge amount is Rs. 100' });
    }

    // Verify ownership
    const meterCheck = await pool.query(
      'SELECT id, balance, meter_number FROM meters WHERE id = $1 AND user_id = $2',
      [meterId, userId]
    );
    if (meterCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const prevBalance = parseFloat(meterCheck.rows[0].balance);
    const rechargeAmount = parseFloat(amount);
    const newBalance = prevBalance + rechargeAmount;
    const method = paymentMethod || 'card';

    // Update balance
    await pool.query(
      'UPDATE meters SET balance = $1 WHERE id = $2',
      [newBalance.toFixed(2), meterId]
    );

    const txnId = `TXN-${Date.now()}`;

    // Record in payments table
    await pool.query(
      `INSERT INTO payments (user_id, meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, meterId, rechargeAmount, method, txnId, prevBalance.toFixed(2), newBalance.toFixed(2), 'Success']
    );

    // Insert payment success notification
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message) VALUES ($1, $2, $3, $4, $5)`,
      [
        userId, meterId, 'success',
        'Recharge Successful',
        `Rs. ${rechargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} credited to meter ${meterCheck.rows[0].meter_number}. New balance: Rs. ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Ref: ${txnId}`
      ]
    );

    res.json({
      message: 'Recharge successful',
      prevBalance: prevBalance.toFixed(2),
      newBalance: newBalance.toFixed(2),
      amount: rechargeAmount.toFixed(2),
      paymentMethod: method,
      txnId,
    });
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
