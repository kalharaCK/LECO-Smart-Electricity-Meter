const { pool } = require('../config/db');
const { Parser } = require('json2csv');
const moment = require('moment');

/**
 * Export last N days of analytics as CSV.
 * Query aggregates similar to getAnalytics but for a date range.
 */
const exportAnalyticsCsv = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');

    const gridRes = await pool.query(`
      SELECT reading_date, SUM(consumption) AS grid_kwh, SUM(energy_export) AS solar_export_kwh
      FROM consumption_logs
      WHERE reading_date BETWEEN $1 AND $2
      GROUP BY reading_date
      ORDER BY reading_date;
    `, [startDate, endDate]);

    const fields = ['reading_date', 'grid_kwh', 'solar_export_kwh'];
    const parser = new Parser({ fields });
    const csv = parser.parse(gridRes.rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`analytics_${startDate}_to_${endDate}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Export analytics error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { exportAnalyticsCsv };
