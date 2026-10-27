const { pool } = require('../../config/db');
const { getWalletLifetimePrediction, predictDailyConsumption, simulateWalletLifetime } = require('./predictionService');
const mlClient = require('../../services/mlClient');

/**
 * GET /api/prediction/meter/:meterId
 * Returns full wallet lifetime prediction, daily forecast, PUCSL block analysis,
 * and enriched real-time Python ML online ensemble predictions.
 */
const getMeterPrediction = async (req, res) => {
  try {
    const { meterId } = req.params;
    const userId = req.user.id;

    // Verify meter ownership or staff role
    const meterQuery = req.user.role === 'staff' || req.user.role === 'admin'
      ? 'SELECT * FROM meters WHERE id = $1'
      : 'SELECT * FROM meters WHERE id = $1 AND user_id = $2';
    const meterParams = req.user.role === 'staff' || req.user.role === 'admin'
      ? [meterId]
      : [meterId, userId];

    const meterRes = await pool.query(meterQuery, meterParams);
    if (meterRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meter not found or access denied.' });
    }

    const meter = meterRes.rows[0];
    const balance = parseFloat(meter.balance || 0);
    const limit = parseFloat(meter.emergency_credit_limit || 500);

    const historyRes = await pool.query(
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

    const cycleRes = await pool.query(
      `SELECT GREATEST(0, COALESCE(SUM(consumption) - SUM(energy_export), 0)) as cycle_net 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleRes.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyRes.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      })),
      emergencyCreditLimit: limit,
      emergencyCreditActive: meter.emergency_credit_active
    });

    // Query online ML service asynchronously with graceful fallback
    try {
      const [mlPrepaid, mlHourly, mlStatus] = await Promise.all([
        mlClient.getPrepaidLifetime(meterId, balance),
        mlClient.getHourlyForecast(meterId),
        mlClient.getModelStatus(meterId)
      ]);

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
          hourlyTrajectory: mlHourly?.hourly_trajectory || [],
          modelWeights: mlStatus?.weights || mlPrepaid.model_weights,
          driftDetected: mlStatus?.drift_detected || false
        };
      } else {
        prediction.ml = { isAvailable: false, status: 'OFFLINE_FALLBACK' };
      }
    } catch (mlErr) {
      prediction.ml = { isAvailable: false, status: 'OFFLINE_FALLBACK' };
    }

    res.json({
      success: true,
      meterId: Number(meterId),
      prediction
    });
  } catch (err) {
    console.error('[Prediction Module Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to compute meter prediction.' });
  }
};

/**
 * POST /api/prediction/simulate
 * Simulates tariff charges and wallet lifespan under custom user usage scenarios
 */
const simulatePrediction = async (req, res) => {
  try {
    const { walletBalance, currentCycleKWh, currentCycleDay, dailyKwhEstimate, scenarioMultiplier } = req.body;

    const dummyHistory = [
      { date: new Date().toISOString().slice(0, 10), consumption: parseFloat(dailyKwhEstimate || 5), dayOfWeek: new Date().getDay() }
    ];

    const estimatedDays = simulateWalletLifetime({
      walletBalance: parseFloat(walletBalance || 1000),
      currentCycleKWh: parseFloat(currentCycleKWh || 0),
      currentCycleDay: parseInt(currentCycleDay || 1),
      dailyHistory: dummyHistory,
      scenarioMultiplier: parseFloat(scenarioMultiplier || 1.0)
    });

    res.json({
      success: true,
      simulatedDays: Math.round(estimatedDays * 10) / 10
    });
  } catch (err) {
    console.error('[Prediction Simulation Error]:', err);
    res.status(500).json({ success: false, error: 'Simulation computation failed.' });
  }
};

/**
 * GET /api/prediction/ml/hourly/:meterId
 * Returns ML 24-hour hourly trajectory
 */
const getMLHourlyForecast = async (req, res) => {
  try {
    const { meterId } = req.params;
    const forecast = await mlClient.getHourlyForecast(meterId);
    if (!forecast) {
      return res.status(503).json({ success: false, error: 'ML Forecasting Service currently unavailable' });
    }
    res.json({ success: true, meterId: Number(meterId), forecast });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/prediction/ml/prepaid/:meterId
 * Returns ML Prepaid lifetime simulation
 */
const getMLPrepaidForecast = async (req, res) => {
  try {
    const { meterId } = req.params;
    const balance = req.query.balance ? parseFloat(req.query.balance) : undefined;
    const result = await mlClient.getPrepaidLifetime(meterId, balance);
    if (!result) {
      return res.status(503).json({ success: false, error: 'ML Forecasting Service currently unavailable' });
    }
    res.json({ success: true, meterId: Number(meterId), result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/prediction/ml/postpaid/:meterId
 * Returns ML Postpaid monthly bill forecast
 */
const getMLPostpaidForecast = async (req, res) => {
  try {
    const { meterId } = req.params;
    const result = await mlClient.getPostpaidForecast(meterId);
    if (!result) {
      return res.status(503).json({ success: false, error: 'ML Forecasting Service currently unavailable' });
    }
    res.json({ success: true, meterId: Number(meterId), result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/prediction/ml/demand/:meterId
 * Returns ML next-month recharge demand & trend
 */
const getMLRechargeDemand = async (req, res) => {
  try {
    const { meterId } = req.params;
    const result = await mlClient.getRechargeDemand(meterId);
    if (!result) {
      return res.status(503).json({ success: false, error: 'ML Forecasting Service currently unavailable' });
    }
    res.json({ success: true, meterId: Number(meterId), result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/prediction/ml/status/:meterId
 * Returns ML model status, weights, drift events
 */
const getMLModelStatus = async (req, res) => {
  try {
    const { meterId } = req.params;
    const status = await mlClient.getModelStatus(meterId);
    if (!status) {
      return res.status(503).json({ success: false, error: 'ML Service currently unavailable' });
    }
    res.json({ success: true, meterId: Number(meterId), status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getMeterPrediction,
  simulatePrediction,
  getMLHourlyForecast,
  getMLPrepaidForecast,
  getMLPostpaidForecast,
  getMLRechargeDemand,
  getMLModelStatus
};

