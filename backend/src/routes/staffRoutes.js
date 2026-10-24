const express = require('express');
const { requireStaff } = require('../middlewares/authMiddleware');
const { 
  getAllMetersForStaff, 
  toggleMeterRelay, 
  staffTopupMeter 
} = require('../controllers/meterController');
const { 
  getAllComplaints, 
  updateComplaintStatus 
} = require('../controllers/complaintController');
const {
  getStaffPayhereTransactions,
  verifyStaffPayhereTransaction
} = require('../controllers/payhereController');
const { pool } = require('../config/db');

const router = express.Router();

// Strict Security Barrier: All staff endpoints require valid LECO Staff authorization
router.use(requireStaff);

/**
 * GET /api/staff/me
 * Profile details of authenticated staff officer
 */
router.get('/me', async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff user not found.' });
    }
    return res.json({ success: true, user: userRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/staff/analytics
 * High-level LECO Grid Telemetry & System Statistics
 */
router.get('/analytics', async (req, res) => {
  try {
    const metersCountRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_meters,
        COUNT(CASE WHEN status = 'Connected' THEN 1 END)::int as connected_meters,
        COUNT(CASE WHEN status != 'Connected' THEN 1 END)::int as disconnected_meters,
        COALESCE(SUM(balance), 0)::numeric as total_customer_balance,
        COUNT(CASE WHEN balance < 0 THEN 1 END)::int as negative_balance_meters
      FROM meters
    `);

    const complaintsCountRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_complaints,
        COUNT(CASE WHEN status NOT IN ('resolved', 'closed') THEN 1 END)::int as active_complaints,
        COUNT(CASE WHEN priority = 'critical' AND status NOT IN ('resolved', 'closed') THEN 1 END)::int as critical_complaints
      FROM complaints
    `);

    const gridLoadRes = await pool.query(`
      SELECT 
        COALESCE(SUM(consumption), 0)::numeric as today_grid_kwh,
        COALESCE(SUM(energy_export), 0)::numeric as today_solar_export_kwh
      FROM consumption_logs
      WHERE reading_date = CURRENT_DATE
    `);

    return res.json({
      success: true,
      data: {
        meters: metersCountRes.rows[0],
        complaints: complaintsCountRes.rows[0],
        grid: gridLoadRes.rows[0],
        serverTime: new Date().toISOString()
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Meters Management (Grid Control)
 */
router.get('/meters', getAllMetersForStaff);
router.post('/meters/:meterId/relay', toggleMeterRelay);
router.post('/meters/:meterId/topup', staffTopupMeter);

/**
 * Complaints Management
 */
router.get('/complaints', getAllComplaints);
router.patch('/complaints/:id/status', updateComplaintStatus);

/**
 * PayHere Payments Audit & Verification
 */
router.get('/payments/payhere-transactions', getStaffPayhereTransactions);
router.post('/payments/:id/verify-payhere', verifyStaffPayhereTransaction);

module.exports = router;
