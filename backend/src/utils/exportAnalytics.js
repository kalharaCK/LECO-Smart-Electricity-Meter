const { pool } = require('../config/db');

/**
 * Export last N days of analytics as CSV.
 * Query aggregates similar to getAnalytics but for a date range.
 */
const exportAnalyticsCsv = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startDate = past.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    const gridRes = await pool.query(`
      SELECT reading_date, SUM(consumption) AS grid_kwh, SUM(energy_export) AS solar_export_kwh
      FROM consumption_logs
      WHERE reading_date BETWEEN $1 AND $2
      GROUP BY reading_date
      ORDER BY reading_date;
    `, [startDate, endDate]);

    const fields = ['reading_date', 'grid_kwh', 'solar_export_kwh'];
    const csvHeader = fields.join(',');
    const csvRows = (gridRes.rows || []).map(row =>
      fields.map(field => {
        const val = row[field];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [csvHeader, ...csvRows].join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment(`analytics_${startDate}_to_${endDate}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Export analytics error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { exportAnalyticsCsv };
