const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { getWalletLifetimePrediction } = require('../services/predictionEngine');
const { calculateDomesticBill } = require('../services/tariffEngine');
const { sanitizeString } = require('../middlewares/sanitizer');
const { emitMeterUpdate, emitNotification } = require('../services/socketService');
const smsService = require('../services/smsService');
const mlClient = require('../services/mlClient');
const { logStaffActivity } = require('../services/activityLogService');

/**
 * Automatically ensures baseline consumption logs exist for a meter,
 * and synchronizes live hardware telemetry from `meter_readings` into `consumption_logs`.
 * @param {number|string} meterId 
 * @param {string} [meterNum] 
 * @param {number} [dailyAvg] 
 */
async function syncMeterTelemetryAndLogs(meterId, meterNum, dailyAvg) {
  try {
    let baseDaily = parseFloat(dailyAvg || 5.0);
    if (baseDaily > 25) {
      baseDaily = +(baseDaily / 30).toFixed(2); // Convert daily average LKR to kWh (~4-6 kWh)
    }
    if (baseDaily <= 0) baseDaily = 5.0;

    // 1. Inspect live hardware telemetry from meter_readings
    let latestHwEnergy = 0;    // in kWh
    let latestHwEnergyWh = 0;  // in Wh
    let latestHwEnergyMwh = 0; // in mWhr
    let latestHwPower = 0;     // in kW
    let latestHwPowerW = 0;    // in Watts
    let latestHwPowerMw = 0;   // in mW
    let latestHwVoltage = 0;   // in Volts (V)
    let latestHwCurrent = 0;   // in Amperes (A)
    let latestHwCurrentMa = 0; // in mA
    let hwTimestamp = null;
    let hwReceivedAt = null;

    if (meterNum) {
      const hwRes = await pool.query(
        `SELECT voltage, current, power, energy, meter_timestamp, received_at
         FROM meter_readings
         WHERE UPPER(meter_id) = UPPER($1)
         ORDER BY id DESC LIMIT 1`,
        [meterNum]
      );
      if (hwRes.rows.length > 0) {
        const hw = hwRes.rows[0];
        const rawV = parseFloat(hw.voltage || 0);
        const rawC = parseFloat(hw.current || 0); // comes in mA
        const rawP = parseFloat(hw.power || 0);   // comes in mW
        const rawE = parseFloat(hw.energy || 0);  // comes in mWhr

        // Conversions requested by user:
        // 1. Voltage: divide by 10 to get real value (V)
        latestHwVoltage = +(rawV / 10.0).toFixed(1);

        // 2. Current: comes in mA -> convert to Amperes (A)
        latestHwCurrent = +(rawC / 1000.0).toFixed(3);
        latestHwCurrentMa = rawC;

        // 3. Power: comes in as mW -> convert to Watts (W) and Kilowatts (kW)
        latestHwPowerW = +(rawP / 1000.0).toFixed(2);
        latestHwPower = +(rawP / 1000000.0).toFixed(4);
        latestHwPowerMw = rawP;

        // 4. Energy: comes in as mWhr -> convert to Wh and kWh
        latestHwEnergyWh = +(rawE / 1000.0).toFixed(2);
        latestHwEnergy = +(rawE / 1000000.0).toFixed(4);
        latestHwEnergyMwh = rawE;

        hwTimestamp = hw.meter_timestamp;
        hwReceivedAt = hw.received_at;
      }
    }

    // 2. Check existing count in consumption_logs for this meter
    const countRes = await pool.query(
      `SELECT COUNT(*) as count FROM consumption_logs WHERE meter_id = $1`,
      [meterId]
    );
    const logCount = parseInt(countRes.rows[0]?.count || 0, 10);
    const isMicroScale = latestHwEnergy > 0 && latestHwEnergy < 0.1;

    if (logCount === 0) {
      // Seed 7 days of realistic baseline data ending today
      const currentHour = new Date().getHours();
      for (let i = 6; i >= 1; i--) {
        const variance = Math.sin((7 - i) * 0.8) * 0.6;
        let val;
        if (isMicroScale) {
          val = +(Math.max(0.001, latestHwEnergy * (0.85 + Math.sin(i) * 0.15))).toFixed(4);
        } else {
          val = +(Math.max(1.5, baseDaily + variance)).toFixed(2);
        }
        await pool.query(
          `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
           VALUES ($1, CURRENT_DATE - ($2 || ' days')::INTERVAL, 12, $3, 0)`,
          [meterId, i, val]
        );
      }
      // Today (i = 0): use live hardware reading if available, or day baseline
      const todayVal = latestHwEnergy > 0 ? latestHwEnergy : (isMicroScale ? 0.002 : +(baseDaily * 0.45).toFixed(2));
      await pool.query(
        `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
         VALUES ($1, CURRENT_DATE, $2, $3, 0)`,
        [meterId, currentHour, todayVal]
      );
    } else if (latestHwEnergy > 0) {
      // Meter has historical logs; synchronize today's row with live hardware energy
      const todayCheck = await pool.query(
        `SELECT id, consumption FROM consumption_logs 
         WHERE meter_id = $1 AND reading_date = CURRENT_DATE 
         ORDER BY reading_hour DESC LIMIT 1`,
        [meterId]
      );
      if (todayCheck.rows.length === 0) {
        const currentHour = new Date().getHours();
        await pool.query(
          `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
           VALUES ($1, CURRENT_DATE, $2, $3, 0)`,
          [meterId, currentHour, latestHwEnergy]
        );
      } else {
        const currentLogged = parseFloat(todayCheck.rows[0].consumption || 0);
        if (latestHwEnergy > 0 && Math.abs(currentLogged - latestHwEnergy) > 0.0001) {
          await pool.query(
            `UPDATE consumption_logs SET consumption = $1 WHERE id = $2`,
            [latestHwEnergy, todayCheck.rows[0].id]
          );
        }
      }
    }

    return {
      voltage: latestHwVoltage || 230.0,
      current: latestHwCurrent || 0.0,
      currentMa: latestHwCurrentMa || 0.0,
      power: latestHwPower || 0.0,        // in kW
      powerW: latestHwPowerW || 0.0,      // in Watts
      powerMw: latestHwPowerMw || 0.0,    // in mW
      energy: latestHwEnergy || 0.0,      // in kWh
      energyWh: latestHwEnergyWh || 0.0,  // in Wh
      energyMwh: latestHwEnergyMwh || 0.0,// in mWhr
      meterTimestamp: hwTimestamp,
      receivedAt: hwReceivedAt
    };
  } catch (err) {
    console.error('Error in syncMeterTelemetryAndLogs:', err);
    return null;
  }
}

/**
 * Broadcasts latest meter telemetry, balance, and prediction over WebSocket
 * @param {number|string} meterId 
 */
async function broadcastMeterState(meterId) {
  try {
    const meterRow = await pool.query(
      `SELECT id, user_id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active, daily_average 
       FROM meters WHERE id = $1`,
      [meterId]
    );
    if (meterRow.rows.length === 0) return null;
    const meter = meterRow.rows[0];
    await syncMeterTelemetryAndLogs(meterId, meter.meter_number, meter.daily_average);
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

    try {
      const mlPrepaid = await mlClient.getPrepaidLifetime(meterId, balance, { timeout: 500 });
      if (mlPrepaid) {
        prediction.ml = {
          isAvailable: true,
          coldStartStage: mlPrepaid.cold_start_stage,
          expectedRemainingHours: mlPrepaid.expected_remaining_hours,
          expectedRemainingDays: mlPrepaid.expected_remaining_days,
          predictedExhaustionTime: mlPrepaid.predicted_exhaustion_time,
          conservativeWarningTime: mlPrepaid.conservative_warning_time,
          trajectories: mlPrepaid.trajectories,
          confidenceScore: mlPrepaid.confidence_score,
          modelWeights: mlPrepaid.model_weights,
          dailyBurnRate: mlPrepaid.daily_burn_rate_lkr
        };
      } else {
        prediction.ml = { isAvailable: false };
      }
    } catch (_) {
      prediction.ml = { isAvailable: false };
    }

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

    // Query latest real telemetry reading for live power and solar export for CURRENT_DATE
    const isMeterActive = meter.status === 'Connected';
    const latestLogRes = await pool.query(
      `SELECT consumption, energy_export FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date = CURRENT_DATE
       ORDER BY reading_hour DESC LIMIT 1`,
      [meterId]
    );
    const livePower = (isMeterActive && latestLogRes.rows.length > 0) ? parseFloat(latestLogRes.rows[0].consumption || 0).toFixed(2) : '0.00';
    const liveExport = (isMeterActive && latestLogRes.rows.length > 0) ? parseFloat(latestLogRes.rows[0].energy_export || 0).toFixed(2) : '0.00';

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
      currentPower: livePower,
      currentExport: liveExport,
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
    if (res.headersSent) return;
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meters:', error);
    if (res.headersSent) return;
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

    // Retrieve requesting customer profile to verify National Identity Card (NIC)
    const userRes = await pool.query('SELECT id, nic, email, full_name FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User account not found.' });
    }
    const currentUser = userRes.rows[0];

    // Check if meter was provisioned/registered in the database
    const cleanMeterNum = String(meterNumber).trim().toUpperCase();
    const cleanAccountNum = String(accountNumber).trim().toUpperCase();
    const cleanPin = String(pin).trim();

    const existingMeterResult = await pool.query(
      `SELECT id, user_id, meter_number, account_number, pin, staff_passcode, registered_nic, name, balance
       FROM meters WHERE UPPER(meter_number) = $1`,
      [cleanMeterNum]
    );

    if (existingMeterResult.rows.length > 0) {
      const existingMeter = existingMeterResult.rows[0];

      // Anti-Theft Security Check 1: Meter Ownership Conflict
      if (existingMeter.user_id && existingMeter.user_id !== userId) {
        return res.status(400).json({ message: 'This meter is already linked to another account' });
      }

      if (existingMeter.user_id === userId) {
        return res.status(400).json({ message: 'Meter is already linked to your account' });
      }

      // Anti-Theft Security Check 2: NIC Registration Matching
      const customerNic = String(currentUser.nic || '').trim().toUpperCase();
      const registeredNic = String(existingMeter.registered_nic || '').trim().toUpperCase();

      if (registeredNic) {
        if (!customerNic) {
          return res.status(403).json({
            message: 'Your profile does not have an NIC number on file. Please update your profile or contact LECO to verify your identity.'
          });
        }
        if (customerNic !== registeredNic) {
          return res.status(403).json({
            message: `Anti-Theft Protection: This meter is registered under NIC (${registeredNic.slice(0, 4)}****). Your account NIC does not match the registered owner NIC. Registration blocked.`
          });
        }
      }

      // Passcode & Account Number Verification
      const isAccountValid = cleanAccountNum === String(existingMeter.account_number).trim().toUpperCase();

      let isPinValid = false;
      if (existingMeter.pin) {
        if (existingMeter.pin.startsWith('$2')) {
          isPinValid = await bcrypt.compare(cleanPin, existingMeter.pin);
        } else {
          isPinValid = cleanPin === String(existingMeter.pin).trim();
        }
      }
      if (!isPinValid && existingMeter.staff_passcode) {
        isPinValid = cleanPin.toUpperCase() === String(existingMeter.staff_passcode).trim().toUpperCase();
      }

      if (!isPinValid || !isAccountValid) {
        return res.status(401).json({ message: 'Invalid Meter Passcode or Account Number. Verification failed.' });
      }

      // Link unassigned meter to the requesting user
      const meterName = sanitizeString(name || existingMeter.name || 'Home', 100);
      const linkResult = await pool.query(
        `UPDATE meters 
         SET user_id = $1, name = $2, registered_nic = COALESCE(registered_nic, $3)
         WHERE id = $4 AND (user_id IS NULL OR user_id = $1)
         RETURNING id, user_id, meter_number, account_number, registered_nic, balance, status, daily_average, name, 
                   emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at, created_at`,
        [userId, meterName, customerNic || null, existingMeter.id]
      );

      if (linkResult.rows.length === 0) {
        return res.status(409).json({ message: 'This meter has already been linked to an account.' });
      }

      return res.status(200).json({ message: 'Meter linked successfully', meter: linkResult.rows[0] });
    }

    return res.status(404).json({
      message: 'Meter is not registered. Contact LECO to provision the meter before linking it.'
    });
  } catch (error) {
    console.error('Error adding meter:', error);
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
    const meterCheck = await pool.query(
      `SELECT id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active, daily_average 
       FROM meters WHERE id = $1 AND user_id = $2`,
      [meterId, req.user.id]
    );
    if (meterCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const meterData = meterCheck.rows[0];
    const isMeterActive = (meterData.status) === 'Connected';
    const meterNum = meterData.meter_number;

    // Synchronize telemetry & ensure baseline logs exist before running queries
    const liveTelemetry = await syncMeterTelemetryAndLogs(meterId, meterNum, meterData.daily_average);

    // Fetch all consumption metrics, chart history, and telemetry logs concurrently
    const [aggregatesRes, historyRes, latestLogRes] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(consumption) FILTER (WHERE reading_date = CURRENT_DATE), 0) as today_import,
          COALESCE(SUM(energy_export) FILTER (WHERE reading_date = CURRENT_DATE), 0) as today_export,
          COALESCE(SUM(consumption) FILTER (WHERE reading_date = CURRENT_DATE - INTERVAL '1 day'), 0) as yesterday_import,
          COALESCE(SUM(energy_export) FILTER (WHERE reading_date = CURRENT_DATE - INTERVAL '1 day'), 0) as yesterday_export,
          COALESCE(SUM(consumption) FILTER (WHERE reading_date >= CURRENT_DATE - INTERVAL '7 days'), 0) as week_import,
          COALESCE(SUM(energy_export) FILTER (WHERE reading_date >= CURRENT_DATE - INTERVAL '7 days'), 0) as week_export,
          COALESCE(SUM(consumption) FILTER (WHERE reading_date >= CURRENT_DATE - INTERVAL '14 days' AND reading_date < CURRENT_DATE - INTERVAL '7 days'), 0) as last_week_import,
          COALESCE(SUM(energy_export) FILTER (WHERE reading_date >= CURRENT_DATE - INTERVAL '14 days' AND reading_date < CURRENT_DATE - INTERVAL '7 days'), 0) as last_week_export,
          COALESCE(SUM(consumption) FILTER (WHERE reading_date >= date_trunc('month', CURRENT_DATE)), 0) as month_import,
          COALESCE(SUM(energy_export) FILTER (WHERE reading_date >= date_trunc('month', CURRENT_DATE)), 0) as month_export,
          GREATEST(0, COALESCE(SUM(consumption) FILTER (WHERE reading_date >= date_trunc('month', CURRENT_DATE)), 0) - COALESCE(SUM(energy_export) FILTER (WHERE reading_date >= date_trunc('month', CURRENT_DATE)), 0)) as cycle_net
        FROM consumption_logs
        WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '60 days'
      `, [meterId]),

      pool.query(`
        SELECT 
          to_char(reading_date, 'Mon DD') as date_label,
          reading_date::text as date,
          SUM(consumption) as import,
          SUM(energy_export) as export,
          GREATEST(0, SUM(consumption) - SUM(energy_export)) as consumption,
          EXTRACT(DOW FROM reading_date)::int as day_of_week
        FROM consumption_logs
        WHERE meter_id = $1
        GROUP BY reading_date
        ORDER BY reading_date DESC
        LIMIT 60
      `, [meterId]),

      pool.query(`
        SELECT consumption, energy_export FROM consumption_logs 
        WHERE meter_id = $1 AND reading_date = CURRENT_DATE
        ORDER BY reading_hour DESC LIMIT 1
      `, [meterId])
    ]);

    const agg = aggregatesRes.rows[0] || {};
    let currentPower = '0.00';
    if (isMeterActive && liveTelemetry && liveTelemetry.power > 0) {
      currentPower = liveTelemetry.power < 0.01 
        ? liveTelemetry.power.toFixed(4) 
        : liveTelemetry.power.toFixed(2);
    } else if (isMeterActive && latestLogRes.rows.length > 0) {
      currentPower = parseFloat(latestLogRes.rows[0].consumption || 0).toFixed(2);
    }
    const currentExport = (isMeterActive && latestLogRes.rows.length > 0) ? parseFloat(latestLogRes.rows[0].energy_export || 0).toFixed(2) : '0.00';

    const balance = parseFloat(meterData.balance || 0);
    const emergencyCreditLimit = parseFloat(meterData.emergency_credit_limit || 500);
    const emergencyCreditActive = Boolean(meterData.emergency_credit_active);

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(agg.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyRes.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      })),
      emergencyCreditLimit,
      emergencyCreditActive
    });

    try {
      const mlPrepaid = await mlClient.getPrepaidLifetime(meterId, balance, { timeout: 500 });
      if (mlPrepaid) {
        prediction.ml = {
          isAvailable: true,
          coldStartStage: mlPrepaid.cold_start_stage,
          expectedRemainingHours: mlPrepaid.expected_remaining_hours,
          expectedRemainingDays: mlPrepaid.expected_remaining_days,
          predictedExhaustionTime: mlPrepaid.predicted_exhaustion_time,
          conservativeWarningTime: mlPrepaid.conservative_warning_time,
          trajectories: mlPrepaid.trajectories,
          confidenceScore: mlPrepaid.confidence_score,
          modelWeights: mlPrepaid.model_weights,
          dailyBurnRate: mlPrepaid.daily_burn_rate_lkr
        };
      } else {
        prediction.ml = { isAvailable: false };
      }
    } catch (_) {
      prediction.ml = { isAvailable: false };
    }

    // Extract recent 7 daily records from historyRes in ascending date order for the chart
    const recent7 = historyRes.rows.slice(0, 7).reverse();
    let finalChartData = recent7.map(r => ({
      date: r.date_label || r.date,
      import: parseFloat(r.import || 0).toFixed(1),
      export: parseFloat(r.export || 0).toFixed(1),
      net: (parseFloat(r.import || 0) - parseFloat(r.export || 0)).toFixed(1)
    }));

    if (finalChartData.length === 0) {
      const baseDaily = parseFloat(meterData.daily_average || 5.0);
      finalChartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        const isToday = i === 0;
        const val = isToday && liveTelemetry?.energy ? liveTelemetry.energy : +(baseDaily + Math.sin(7 - i) * 0.4).toFixed(1);
        finalChartData.push({
          date: dateStr,
          import: parseFloat(val).toFixed(1),
          export: "0.0",
          net: parseFloat(val).toFixed(1)
        });
      }
    }

    const rawToday = parseFloat(agg.today_import != null ? agg.today_import : (liveTelemetry?.energy || 0));
    const todayVal = (rawToday > 0 && rawToday < 0.1) ? rawToday.toFixed(4) : rawToday.toFixed(1);
    const thisWeekVal = parseFloat(agg.week_import || todayVal).toFixed(1);
    const thisMonthVal = parseFloat(agg.month_import || todayVal).toFixed(1);

    res.json({
      today: todayVal,
      yesterday: parseFloat(agg.yesterday_import || 0).toFixed(1),
      thisWeek: thisWeekVal,
      lastWeek: parseFloat(agg.last_week_import || 0).toFixed(1),
      thisMonth: thisMonthVal,
      
      exportToday: parseFloat(agg.today_export || 0).toFixed(1),
      exportYesterday: parseFloat(agg.yesterday_export || 0).toFixed(1),
      exportThisWeek: parseFloat(agg.week_export || 0).toFixed(1),
      exportLastWeek: parseFloat(agg.last_week_export || 0).toFixed(1),
      exportThisMonth: parseFloat(agg.month_export || 0).toFixed(1),
      
      currentPower: currentPower,
      currentExport: currentExport,
      
      prediction: prediction,
      liveTelemetry: liveTelemetry,

      chartData: finalChartData
    });
  } catch (error) {
    console.error('Error fetching consumption:', error);
    if (res.headersSent) return;
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
      if (res.headersSent) return;
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

    if (res.headersSent) return;
    res.json(prediction);
  } catch (error) {
    console.error('Error calculating meter prediction:', error);
    if (res.headersSent) return;
    res.status(500).json({ message: 'Server error calculating prediction' });
  }
};

const rechargeMeter = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { amount, paymentMethod } = req.body;
    const userId = req.user.id;
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey;

    const amountText = typeof amount === 'number' ? String(amount) : amount;
    const rechargeAmount = Number(amountText);
    if (typeof amountText !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
        !Number.isFinite(rechargeAmount) || rechargeAmount < 100 || rechargeAmount > 100000) {
      return res.status(400).json({ message: 'Recharge amount must be between Rs. 100 and Rs. 100,000 with at most two decimal places.' });
    }
    const allowedMethods = new Set(['card', 'wallet', 'bank']);
    if (paymentMethod !== undefined && !allowedMethods.has(paymentMethod)) {
      return res.status(400).json({ message: 'Unsupported simulated payment method.' });
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

      // Dispatch Payment Confirmation SMS via Text.lk
      try {
        const userMobQuery = await client.query(
          `SELECT COALESCE(u.mobile_number, s.phone_number) as phone 
           FROM users u 
           LEFT JOIN user_settings s ON u.id = s.user_id 
           WHERE u.id = $1`,
          [userId]
        );
        const customerPhone = userMobQuery.rows[0]?.phone;
        if (customerPhone) {
          smsService.sendEventSms({
            recipient: customerPhone,
            eventType: 'payment',
            language: 'en',
            data: {
              amount: rechargeAmount.toFixed(2),
              account_no: meterCheck.rows[0].account_number || meterCheck.rows[0].meter_number,
              ref: txnId,
              balance: newBalance.toFixed(2)
            }
          }).catch(err => console.error('[Recharge SMS error]:', err.message));
        }
      } catch (smsErr) {
        console.error('[Recharge SMS Phone Fetch Error]:', smsErr.message);
      }

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

    // Dispatch Lifeline Mode SMS Alert
    try {
      const userMobQuery = await pool.query(
        `SELECT COALESCE(u.mobile_number, s.phone_number) as phone, s.preferred_language
         FROM users u 
         LEFT JOIN user_settings s ON u.id = s.user_id 
         WHERE u.id = $1`,
        [userId]
      );
      const customerPhone = userMobQuery.rows[0]?.phone;
      const lang = userMobQuery.rows[0]?.preferred_language || 'en';
      if (customerPhone) {
        smsService.sendEventSms({
          recipient: customerPhone,
          eventType: 'lifeline_activated',
          language: lang,
          data: {
            account_no: meter.account_number || meter.meter_number,
            buffer: limit.toFixed(2)
          }
        }).catch(err => console.error('[Lifeline SMS error]:', err.message));
      }
    } catch (smsErr) {
      console.error('[Lifeline SMS Error]:', smsErr.message);
    }

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

    // Record consumption telemetry for current hour
    const currentHour = new Date().getHours();
    await pool.query(
      `INSERT INTO consumption_logs (meter_id, reading_date, reading_hour, consumption, energy_export)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
      [meterId, currentHour, kwh, exportKwh]
    );

    // Calculate accrued monthly usage & PUCSL bill after this consumption (do NOT deduct from prepaid balance)
    const monthResult = await pool.query(
      `SELECT COALESCE(SUM(consumption), 0) as month_kwh,
              COALESCE(SUM(energy_export), 0) as month_export
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );
    const currentMonthKwh = Math.max(0, parseFloat(monthResult.rows[0]?.month_kwh || 0) - parseFloat(monthResult.rows[0]?.month_export || 0));
    const bill = calculateDomesticBill(currentMonthKwh);
    const projectedNet = Math.round((prevBalance - bill.totalCharge) * 100) / 100;

    // Check low balance warnings based on projected net balance (Prepaid Balance - Accrued Monthly Bill)
    if (projectedNet <= 100 && !meter.emergency_credit_active) {
      const recentAlert = await pool.query(
        `SELECT id FROM notifications 
         WHERE meter_id = $1 AND type = 'alert' AND title = 'Low Balance Warning' 
           AND created_at >= NOW() - INTERVAL '1 hour'`,
        [meterId]
      );
      if (recentAlert.rows.length === 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, meter_id, type, title, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            meterId,
            'alert',
            'Low Balance Warning',
            `Current monthly usage has reached Rs. ${bill.totalCharge.toFixed(2)} (${currentMonthKwh.toFixed(1)} kWh). Your projected net remaining credit is Rs. ${projectedNet.toFixed(2)}. Please recharge or activate Lifeline Emergency Credit before cycle settlement.`
          ]
        );
      }
    }

    // Feed incoming telemetry asynchronously to Python ML Engine (non-blocking)
    mlClient.ingestTelemetry({
      meterId: Number(meterId),
      timestamp: new Date().toISOString(),
      cumulativeKwh: currentMonthKwh,
      prepaidBalance: prevBalance,
      connectionType: 'prepaid',
      tariffId: 'DOMESTIC_D1',
      billingCycleDay: new Date().getDate(),
      voltage: 230.0,
      currentAmps: (kwh * 1000) / 230.0,
      powerFactor: 0.96
    }).catch(e => console.warn('[ML Telemetry Ingest Warning]:', e.message));

    // Real-time WebSocket Broadcast (instantly notifies frontend without full page reload)
    const livePayload = await broadcastMeterState(meterId);

    res.json({
      message: `Simulated ${kwh} kWh consumed. Accrued monthly usage: ${currentMonthKwh.toFixed(1)} kWh (Rs. ${bill.totalCharge.toFixed(2)} - ${bill.group}). Prepaid balance retained at Rs. ${prevBalance.toFixed(2)} until cycle settlement.`,
      kwhAdded: kwh,
      currentMonthKwh,
      currentMonthBill: bill.totalCharge,
      tariffGroup: bill.group,
      energyCharge: bill.energyCharge,
      fixedCharge: bill.fixedCharge,
      prepaidBalance: prevBalance,
      projectedNet,
      status: meter.status,
      isLifelineActive: meter.emergency_credit_active,
      livePayload
    });
  } catch (error) {
    console.error('Error simulating consumption:', error);
    res.status(500).json({ message: 'Server error simulating consumption' });
  }
};

/**
 * End-of-Monthly-Cycle Settlement:
 * Deducts the total accrued monthly bill from the prepaid balance.
 * If balance goes negative, checks Lifeline Mode (Emergency Credit buffer).
 * Records a formal settlement transaction in the payments table.
 */
const settleMonthlyCycle = async (req, res) => {
  const client = await pool.connect();
  try {
    const { meterId } = req.params;
    const userId = req.user.id;
    const isStaff = req.user.role === 'staff';

    await client.query('BEGIN');

    // Fetch meter with row-level lock
    const meterQuery = await client.query(
      `SELECT id, user_id, meter_number, account_number, balance, status, emergency_credit_limit, emergency_credit_active
       FROM meters WHERE id = $1 ${isStaff ? '' : 'AND user_id = $2'} FOR UPDATE`,
      isStaff ? [meterId] : [meterId, userId]
    );

    if (meterQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Meter not found or access denied' });
    }

    const meter = meterQuery.rows[0];
    const prevBalance = parseFloat(meter.balance);
    const limit = parseFloat(meter.emergency_credit_limit || 500);

    // Calculate total net consumption for the current billing cycle
    const cycleQuery = await client.query(
      `SELECT 
         COALESCE(SUM(consumption), 0) as total_import,
         COALESCE(SUM(energy_export), 0) as total_export
       FROM consumption_logs
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    const totalImport = parseFloat(cycleQuery.rows[0]?.total_import || 0);
    const totalExport = parseFloat(cycleQuery.rows[0]?.total_export || 0);
    const netKwh = Math.max(0, totalImport - totalExport);

    // Calculate official PUCSL domestic bill
    const bill = calculateDomesticBill(netKwh);
    const deductionAmount = bill.totalCharge;

    // Deduct from prepaid balance
    const newBalance = Math.round((prevBalance - deductionAmount) * 100) / 100;

    // Evaluate connection status
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

    // Update meter balance and status
    await client.query(
      `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
      [newBalance, newStatus, meterId]
    );

    // Month identifier for reference (e.g., "OCT-2026")
    const now = new Date();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const cycleLabel = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;
    const txnId = `BILL-${cycleLabel}-${Date.now().toString().slice(-4)}`;

    // Record formal settlement in payments ledger
    await client.query(
      `INSERT INTO payments (
         user_id, meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        meter.user_id,
        meterId,
        deductionAmount,
        'Monthly Cycle Settlement',
        txnId,
        prevBalance.toFixed(2),
        newBalance.toFixed(2),
        'Success'
      ]
    );

    // Create detailed notification
    let notificationMsg = `Monthly Billing Cycle (${cycleLabel}) settled: Rs. ${deductionAmount.toFixed(2)} deducted for ${netKwh.toFixed(1)} kWh (${bill.group}). New Prepaid Balance: Rs. ${newBalance.toFixed(2)}. Ref: ${txnId}`;
    if (disconnected) {
      notificationMsg += ` Prepaid balance exhausted. Power disconnected. Please recharge immediately to reconnect.`;
    } else if (newBalance < 0 && meter.emergency_credit_active) {
      notificationMsg += ` Covered by Lifeline Emergency Credit buffer (Buffer remaining: Rs. ${(limit + newBalance).toFixed(2)}).`;
    }

    await client.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        meter.user_id,
        meterId,
        disconnected ? 'alert' : 'info',
        `Monthly Cycle Settled (${cycleLabel})`,
        notificationMsg
      ]
    );

    await client.query('COMMIT');

    // Real-time WebSocket Broadcast
    broadcastMeterState(meterId).catch(e => console.error('WS broadcast error:', e));

    res.json({
      success: true,
      message: `Monthly cycle settled successfully. Rs. ${deductionAmount.toFixed(2)} deducted from prepaid balance.`,
      cycle: cycleLabel,
      netKwh,
      totalImport,
      totalExport,
      bill: {
        totalCharge: bill.totalCharge,
        energyCharge: bill.energyCharge,
        fixedCharge: bill.fixedCharge,
        tariffGroup: bill.group,
        effectiveRate: bill.effectiveRate
      },
      prevBalance,
      newBalance,
      status: newStatus,
      disconnected,
      isLifelineActive: meter.emergency_credit_active,
      txnId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error settling monthly cycle:', error);
    res.status(500).json({ message: 'Server error during monthly cycle settlement' });
  } finally {
    client.release();
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
        m.registered_nic,
        m.staff_passcode,
        (m.user_id IS NOT NULL) AS is_claimed,
        m.created_at,
        u.id AS customer_id,
        u.email AS customer_email,
        u.role AS customer_role,
        COALESCE(u.nic, m.registered_nic, '') AS customer_nic,
        COALESCE(u.full_name, 'Unassigned / Ready to Link') AS customer_name,
        u.created_at AS customer_since,
        COALESCE(u.mobile_number, us.phone_number, '') AS phone_number,
        COALESCE(us.tariff_type, 'Domestic D-1 (PUCSL Block Tariff)') AS tariff_type,
        COALESCE(us.low_balance_threshold, 300.00) AS low_balance_threshold,
        COALESCE(us.daily_kwh_budget, 12.00) AS daily_kwh_budget,
        COALESCE(today_c.today_consumption, 0) AS today_kwh,
        COALESCE(total_c.total_consumption, 0) AS total_kwh,
        COALESCE(complaints_cnt.open_complaints, 0) AS open_complaints_count,
        COALESCE(last_pay.last_payment_amount, 0) AS last_payment_amount,
        last_pay.last_payment_date,
        hw.hardware_voltage,
        hw.hardware_current,
        hw.hardware_power,
        hw.hardware_power_w,
        hw.hardware_energy,
        hw.hardware_energy_wh,
        hw.hardware_meter_timestamp,
        hw.hardware_last_seen,
        COALESCE(hw.telemetry_readings_count, 0) AS telemetry_readings_count,
        (hw.meter_id IS NOT NULL) AS has_hardware_telemetry,
        (hw.hardware_last_seen IS NOT NULL AND hw.hardware_last_seen >= NOW() - INTERVAL '30 minutes') AS is_hardware_active
      FROM meters m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN (
        SELECT 
          r.meter_id,
          ROUND((r.voltage / 10.0)::numeric, 1) AS hardware_voltage,
          ROUND((r.current / 1000.0)::numeric, 3) AS hardware_current,
          ROUND((r.power / 1000000.0)::numeric, 4) AS hardware_power,
          ROUND((r.power / 1000.0)::numeric, 2) AS hardware_power_w,
          ROUND((r.energy / 1000000.0)::numeric, 4) AS hardware_energy,
          ROUND((r.energy / 1000.0)::numeric, 2) AS hardware_energy_wh,
          r.meter_timestamp AS hardware_meter_timestamp,
          r.received_at AS hardware_last_seen,
          rc.readings_count AS telemetry_readings_count
        FROM (
          SELECT DISTINCT ON (meter_id) 
            meter_id, voltage, current, power, energy, meter_timestamp, received_at
          FROM meter_readings
          ORDER BY meter_id, id DESC
        ) r
        JOIN (
          SELECT meter_id, COUNT(*)::int AS readings_count
          FROM meter_readings
          GROUP BY meter_id
        ) rc ON rc.meter_id = r.meter_id
      ) hw ON UPPER(hw.meter_id) = UPPER(m.meter_number)
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

    // Dispatch Relay Status SMS via Text.lk
    try {
      const userMobQuery = await pool.query(
        `SELECT COALESCE(u.mobile_number, s.phone_number) as phone 
         FROM users u 
         LEFT JOIN user_settings s ON u.id = s.user_id 
         WHERE u.id = $1`,
        [meter.user_id]
      );
      const customerPhone = userMobQuery.rows[0]?.phone;
      if (customerPhone) {
        smsService.sendEventSms({
          recipient: customerPhone,
          eventType: 'relay_command',
          language: 'en',
          data: {
            account_no: meter.account_number || meter.meter_number,
            status: newStatus === 'Connected' ? 'Connected (Active)' : 'Disconnected (Cutoff)'
          }
        }).catch(err => console.error('[Relay SMS error]:', err.message));
      }
    } catch (smsErr) {
      console.error('[Relay SMS Phone Fetch Error]:', smsErr.message);
    }

    // Log traceable staff action
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: newStatus === 'Connected' ? 'RELAY_CONNECT' : 'RELAY_CUTOFF',
      targetEntity: `Meter #${meter.meter_number}`,
      details: {
        meterId,
        meterNumber: meter.meter_number,
        accountNumber: meter.account_number,
        previousStatus: meter.status,
        newStatus,
        reason: reason || 'Manual grid control'
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

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

    // Dispatch Staff Adjustment SMS via Text.lk
    try {
      const userMobQuery = await pool.query(
        `SELECT COALESCE(u.mobile_number, s.phone_number) as phone 
         FROM users u 
         LEFT JOIN user_settings s ON u.id = s.user_id 
         WHERE u.id = $1`,
        [meter.user_id]
      );
      const customerPhone = userMobQuery.rows[0]?.phone;
      if (customerPhone) {
        smsService.sendEventSms({
          recipient: customerPhone,
          eventType: 'payment',
          language: 'en',
          data: {
            amount: numAmount.toFixed(2),
            account_no: meter.account_number || meter.meter_number,
            ref: txId,
            balance: newBalance.toFixed(2)
          }
        }).catch(err => console.error('[Staff Topup SMS error]:', err.message));
      }
    } catch (smsErr) {
      console.error('[Staff Topup SMS Phone Fetch Error]:', smsErr.message);
    }

    // Log traceable staff action
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: 'STAFF_MANUAL_TOPUP',
      targetEntity: `Meter #${meter.meter_number}`,
      details: {
        meterId,
        meterNumber: meter.meter_number,
        amount: numAmount,
        previousBalance: prevBalance,
        newBalance,
        reason: reason || 'Manual relief adjustment'
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

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

/**
 * Staff API: Register / Provision a new physical meter with registered NIC and Passcode
 * POST /api/staff/meters/register
 */
const registerMeterForStaff = async (req, res) => {
  try {
    const {
      meter_number,
      account_number,
      registered_nic,
      passcode,
      initial_balance = 0,
      name = 'Home',
      staff_password
    } = req.body;

    if (!meter_number || !String(meter_number).trim()) {
      return res.status(400).json({ success: false, message: 'Meter number is required.' });
    }
    if (!account_number || !String(account_number).trim()) {
      return res.status(400).json({ success: false, message: 'Account number is required.' });
    }
    if (!registered_nic || !String(registered_nic).trim()) {
      return res.status(400).json({ success: false, message: 'Customer National Identity Card (NIC) number is required for meter registration.' });
    }

    // Optional staff password verification if provided
    if (staff_password) {
      const staffRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      if (staffRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Staff profile not found.' });
      }
      const isValid = await bcrypt.compare(String(staff_password), staffRes.rows[0].password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Incorrect staff authorization password.' });
      }
    }

    const cleanMeterNumber = String(meter_number).trim().toUpperCase();
    const cleanAccountNumber = String(account_number).trim().toUpperCase();
    const cleanNic = String(registered_nic).trim().toUpperCase();

    // Check if meter number already exists
    const existing = await pool.query('SELECT id, user_id, meter_number FROM meters WHERE UPPER(meter_number) = $1', [cleanMeterNumber]);
    if (existing.rows.length > 0) {
      const existingMeter = existing.rows[0];
      if (existingMeter.user_id) {
        return res.status(409).json({ success: false, message: `Meter ${cleanMeterNumber} is already registered and claimed by a customer account.` });
      }

      // Meter exists but is unassigned (e.g. pre-discovered hardware meter)
      let securePasscode = passcode && String(passcode).trim();
      if (!securePasscode) {
        securePasscode = String(Math.floor(100000 + Math.random() * 900000));
      }

      const hashedPin = await bcrypt.hash(securePasscode, 10);
      const numBalance = parseFloat(initial_balance) || 0;

      const updateRes = await pool.query(
        `UPDATE meters SET
          account_number = $1,
          registered_nic = $2,
          pin = $3,
          staff_passcode = $4,
          balance = $5,
          name = $6,
          status = 'Connected'
         WHERE id = $7
         RETURNING id, meter_number, account_number, registered_nic, staff_passcode, balance, status, name, created_at`,
        [cleanAccountNumber, cleanNic, hashedPin, securePasscode, numBalance, name ? String(name).trim() : 'Home', existingMeter.id]
      );
      const updatedMeter = updateRes.rows[0];

      if (numBalance > 0) {
        await pool.query(
          `INSERT INTO payments (meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
           VALUES ($1, $2, 'Staff Initial Credit', $3, 0, $4, 'Success')`,
          [updatedMeter.id, numBalance, `PROV-${Date.now()}`, numBalance]
        );
      }

      await logStaffActivity({
        staffId: req.user?.id || null,
        staffEmail: req.user?.email || 'staff@leco.lk',
        actionType: 'METER_PROVISION_UPDATE',
        targetEntity: `Meter #${cleanMeterNumber} (NIC: ${cleanNic})`,
        details: {
          meterId: updatedMeter.id,
          meterNumber: cleanMeterNumber,
          accountNumber: cleanAccountNumber,
          registeredNic: cleanNic,
          passcodeProvided: securePasscode,
          initialBalance: numBalance
        },
        ipAddress: req.ip || '127.0.0.1',
        status: 'success'
      });

      return res.status(200).json({
        success: true,
        message: `Hardware meter ${cleanMeterNumber} provisioned successfully for NIC ${cleanNic}.`,
        meter: updatedMeter,
        passcode: securePasscode
      });
    }

    // Generate secure 6-digit passcode if not provided by staff
    let securePasscode = passcode && String(passcode).trim();
    if (!securePasscode) {
      securePasscode = String(Math.floor(100000 + Math.random() * 900000));
    }

    const hashedPin = await bcrypt.hash(securePasscode, 10);
    const numBalance = parseFloat(initial_balance) || 0;

    const insertRes = await pool.query(
      `INSERT INTO meters (
        meter_number, account_number, pin, staff_passcode, registered_nic,
        balance, status, name, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Connected', $7, NULL)
      RETURNING id, meter_number, account_number, registered_nic, staff_passcode, balance, status, name, created_at`,
      [cleanMeterNumber, cleanAccountNumber, hashedPin, securePasscode, cleanNic, numBalance, name ? String(name).trim() : 'Home']
    );
    const createdMeter = insertRes.rows[0];

    if (numBalance > 0) {
      await pool.query(
        `INSERT INTO payments (meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
         VALUES ($1, $2, 'Staff Initial Credit', $3, 0, $4, 'Success')`,
        [createdMeter.id, numBalance, `PROV-${Date.now()}`, numBalance]
      );
    }

    // Log traceable staff activity
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: 'METER_PROVISION_REGISTER',
      targetEntity: `Meter #${cleanMeterNumber} (NIC: ${cleanNic})`,
      details: {
        meterId: createdMeter.id,
        meterNumber: cleanMeterNumber,
        accountNumber: cleanAccountNumber,
        registeredNic: cleanNic,
        passcodeProvided: securePasscode,
        initialBalance: numBalance
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

    return res.status(201).json({
      success: true,
      message: `Meter ${cleanMeterNumber} registered successfully for NIC ${cleanNic}.`,
      meter: createdMeter,
      passcode: securePasscode
    });
  } catch (err) {
    console.error('[Meter Registration Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to register meter.' });
  }
};

/**
 * Staff API: View or regenerate security passcode for a registered meter
 * POST /api/staff/meters/:meterId/regenerate-passcode
 */
const regenerateMeterPasscodeForStaff = async (req, res) => {
  try {
    const { meterId } = req.params;
    const { staffPassword, customPasscode } = req.body;

    if (!staffPassword) {
      return res.status(400).json({ success: false, message: 'Staff authorization password is required.' });
    }

    const staffRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff profile not found.' });
    }
    const isStaffAuthValid = await bcrypt.compare(String(staffPassword), staffRes.rows[0].password);
    if (!isStaffAuthValid) {
      return res.status(401).json({ success: false, message: 'Incorrect staff authorization password.' });
    }

    const meterRes = await pool.query('SELECT * FROM meters WHERE id = $1', [meterId]);
    if (meterRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meter not found.' });
    }
    const meter = meterRes.rows[0];

    const newPasscode = customPasscode && String(customPasscode).trim()
      ? String(customPasscode).trim()
      : String(Math.floor(100000 + Math.random() * 900000));

    const hashedPin = await bcrypt.hash(newPasscode, 10);

    await pool.query(
      'UPDATE meters SET pin = $1, staff_passcode = $2 WHERE id = $3',
      [hashedPin, newPasscode, meterId]
    );

    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: 'METER_PASSCODE_REGENERATE',
      targetEntity: `Meter #${meter.meter_number}`,
      details: {
        meterId,
        meterNumber: meter.meter_number,
        registeredNic: meter.registered_nic
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

    return res.json({
      success: true,
      message: `Passcode regenerated successfully for meter ${meter.meter_number}.`,
      passcode: newPasscode
    });
  } catch (err) {
    console.error('[Meter Passcode Regenerate Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to regenerate passcode.' });
  }
};

/**
 * Staff API: Directly assign an unassigned/hardware meter to a registered customer
 * POST /api/staff/meters/:meterId/assign
 */
const assignMeterToCustomerForStaff = async (req, res) => {
  try {
    const { meterId } = req.params;
    const {
      customerId,
      customerEmail,
      customerNic,
      passcode,
      initialBalance,
      name,
      staffPassword
    } = req.body;

    if (!staffPassword) {
      return res.status(400).json({ success: false, message: 'Staff authorization password is required to assign meter.' });
    }

    const staffRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff profile not found.' });
    }
    const isStaffAuthValid = await bcrypt.compare(String(staffPassword), staffRes.rows[0].password);
    if (!isStaffAuthValid) {
      return res.status(401).json({ success: false, message: 'Incorrect staff authorization password.' });
    }

    // Check target meter
    const meterRes = await pool.query('SELECT * FROM meters WHERE id = $1', [meterId]);
    if (meterRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meter not found.' });
    }
    const targetMeter = meterRes.rows[0];

    // Find customer account
    let customer = null;
    if (customerId) {
      const cRes = await pool.query('SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE id = $1', [customerId]);
      if (cRes.rows.length > 0) customer = cRes.rows[0];
    } else if (customerNic) {
      const cRes = await pool.query('SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE UPPER(nic) = $1', [String(customerNic).trim().toUpperCase()]);
      if (cRes.rows.length > 0) customer = cRes.rows[0];
    } else if (customerEmail) {
      const cRes = await pool.query('SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE LOWER(email) = $1', [String(customerEmail).trim().toLowerCase()]);
      if (cRes.rows.length > 0) customer = cRes.rows[0];
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Target customer account not found. Please ensure the customer has registered on the platform or provide a valid NIC.'
      });
    }

    const securePasscode = (passcode && String(passcode).trim()) 
      ? String(passcode).trim()
      : (targetMeter.staff_passcode || String(Math.floor(100000 + Math.random() * 900000)));

    const hashedPin = await bcrypt.hash(securePasscode, 10);
    const balanceNum = initialBalance !== undefined && !isNaN(parseFloat(initialBalance)) 
      ? parseFloat(initialBalance) 
      : parseFloat(targetMeter.balance || 0);

    const meterLabel = name && String(name).trim() ? String(name).trim() : (targetMeter.name || 'Primary Residence');
    const assignedNic = customer.nic || targetMeter.registered_nic || null;

    const updateRes = await pool.query(
      `UPDATE meters SET
        user_id = $1,
        registered_nic = $2,
        staff_passcode = $3,
        pin = $4,
        balance = $5,
        name = $6,
        status = 'Connected'
       WHERE id = $7
       RETURNING *`,
      [customer.id, assignedNic, securePasscode, hashedPin, balanceNum, meterLabel, meterId]
    );
    const updatedMeter = updateRes.rows[0];

    // Record adjustment payment if balance changed
    if (balanceNum > 0 && balanceNum !== parseFloat(targetMeter.balance || 0)) {
      await pool.query(
        `INSERT INTO payments (user_id, meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
         VALUES ($1, $2, $3, 'Staff Assignment Initial Credit', $4, $5, $6, 'Success')`,
        [customer.id, meterId, balanceNum, `ASSIGN-${Date.now()}`, targetMeter.balance || 0, balanceNum]
      );
    }

    // Customer Notification
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, 'success', 'Smart Meter Assigned', $3)`,
      [
        customer.id,
        meterId,
        `LECO Smart Meter ${targetMeter.meter_number} (Account #${targetMeter.account_number}) has been assigned to your account with initial balance Rs. ${balanceNum.toFixed(2)}.`
      ]
    );

    // SMS dispatch if phone available
    const customerPhone = customer.mobile_number;
    if (customerPhone) {
      smsService.sendEventSms({
        recipient: customerPhone,
        eventType: 'provisioning',
        language: 'en',
        data: {
          meter_number: targetMeter.meter_number,
          account_no: targetMeter.account_number,
          passcode: securePasscode
        }
      }).catch(err => console.error('[Assign Meter SMS Error]:', err.message));
    }

    // Log staff action
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: 'METER_ASSIGN_TO_CUSTOMER',
      targetEntity: `Meter #${targetMeter.meter_number} -> ${customer.email}`,
      details: {
        meterId,
        meterNumber: targetMeter.meter_number,
        accountNumber: targetMeter.account_number,
        customerId: customer.id,
        customerEmail: customer.email,
        customerNic: customer.nic,
        assignedBalance: balanceNum,
        passcode: securePasscode
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

    return res.json({
      success: true,
      message: `Meter ${targetMeter.meter_number} assigned successfully to ${customer.full_name || customer.email}.`,
      voucher: {
        meterId: updatedMeter.id,
        meterNumber: updatedMeter.meter_number,
        accountNumber: updatedMeter.account_number,
        customerName: customer.full_name || 'LECO Customer',
        customerEmail: customer.email,
        customerNic: customer.nic || '',
        customerPhone: customer.mobile_number || '',
        passcode: securePasscode,
        balance: balanceNum,
        status: updatedMeter.status,
        assignedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Assign Meter Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to assign meter to customer.' });
  }
};

/**
 * Staff API: Fetch hardware meters sending telemetry in meter_readings that are unassigned
 * GET /api/staff/meters/unregistered-hardware
 */
const getUnregisteredHardwareMetersForStaff = async (req, res) => {
  try {
    const query = `
      SELECT 
        mr.meter_id,
        m.id AS meter_db_id,
        m.account_number,
        m.status,
        m.balance,
        m.staff_passcode,
        m.user_id,
        (m.user_id IS NOT NULL) AS is_claimed,
        COUNT(mr.id)::int AS total_telemetry_records,
        MAX(mr.received_at) AS last_seen,
        latest.voltage,
        ROUND((latest.voltage / 10.0)::numeric, 1) AS latest_voltage,
        ROUND((latest.current / 1000.0)::numeric, 3) AS latest_current,
        ROUND((latest.power / 1000000.0)::numeric, 4) AS latest_power,
        ROUND((latest.power / 1000.0)::numeric, 2) AS latest_power_w,
        ROUND((latest.energy / 1000000.0)::numeric, 4) AS latest_energy,
        ROUND((latest.energy / 1000.0)::numeric, 2) AS latest_energy_wh,
        latest.meter_timestamp AS latest_timestamp
      FROM meter_readings mr
      LEFT JOIN meters m ON UPPER(m.meter_number) = UPPER(mr.meter_id)
      LEFT JOIN (
        SELECT DISTINCT ON (meter_id)
          meter_id, voltage, current, power, energy, meter_timestamp, received_at
        FROM meter_readings
        ORDER BY meter_id, id DESC
      ) latest ON latest.meter_id = mr.meter_id
      GROUP BY mr.meter_id, m.id, m.account_number, m.status, m.balance, m.staff_passcode, m.user_id,
               latest.voltage, latest.current, latest.power, latest.energy, latest.meter_timestamp
      ORDER BY last_seen DESC
    `;
    const result = await pool.query(query);
    return res.json({
      success: true,
      hardwareMeters: result.rows
    });
  } catch (err) {
    console.error('[Hardware Meters Telemetry Fetch Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve hardware meters.' });
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
  settleMonthlyCycle,
  setMeterBalance,
  getAllMetersForStaff,
  toggleMeterRelay,
  staffTopupMeter,
  registerMeterForStaff,
  regenerateMeterPasscodeForStaff,
  assignMeterToCustomerForStaff,
  getUnregisteredHardwareMetersForStaff
};
