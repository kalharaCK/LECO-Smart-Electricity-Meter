const { pool } = require('../config/db');

/**
 * Get aggregated analytics data for the portal.
 * Supports both customer and staff via role-based query.
 */
const getAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role?.toLowerCase();

    // Common metrics: total meters, connected, disconnected, total balance.
    const metersRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_meters,
        COUNT(CASE WHEN status = 'Connected' THEN 1 END)::int AS connected_meters,
        COUNT(CASE WHEN status != 'Connected' THEN 1 END)::int AS disconnected_meters,
        COALESCE(SUM(balance), 0)::numeric AS total_balance,
        COUNT(CASE WHEN balance < 0 THEN 1 END)::int AS negative_balance_meters
      FROM meters
      ${role === 'customer' ? 'WHERE owner_id = $1' : ''}
    `, role === 'customer' ? [userId] : []);

    // Complaints stats.
    const complaintsRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_complaints,
        COUNT(CASE WHEN status NOT IN ('resolved', 'closed') THEN 1 END)::int AS active_complaints,
        COUNT(CASE WHEN priority = 'critical' AND status NOT IN ('resolved', 'closed') THEN 1 END)::int AS critical_complaints
      FROM complaints
      ${role === 'customer' ? 'WHERE created_by = $1' : ''}
    `, role === 'customer' ? [userId] : []);

    // Grid load for today.
    const gridRes = await pool.query(`
      SELECT 
        COALESCE(SUM(consumption), 0)::numeric AS today_grid_kwh,
        COALESCE(SUM(energy_export), 0)::numeric AS today_solar_export_kwh
      FROM consumption_logs
      WHERE reading_date = CURRENT_DATE
    `);

    return res.json({
      success: true,
      data: {
        meters: metersRes.rows[0],
        complaints: complaintsRes.rows[0],
        grid: gridRes.rows[0],
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getAnalytics };
