const express = require('express');
const { requireStaff } = require('../middlewares/authMiddleware');
const { 
  getAllMetersForStaff, 
  toggleMeterRelay, 
  staffTopupMeter,
  registerMeterForStaff,
  regenerateMeterPasscodeForStaff,
  assignMeterToCustomerForStaff,
  getUnregisteredHardwareMetersForStaff
} = require('../controllers/meterController');
const { 
  getAllComplaints, 
  updateComplaintStatus 
} = require('../controllers/complaintController');
const {
  getStaffPayhereTransactions,
  verifyStaffPayhereTransaction
} = require('../controllers/payhereController');
const { downloadPaymentReceiptPdf, downloadMeterStatementPdf } = require('../controllers/pdfController');
const { 
  getAllCustomersForStaff, 
  createCustomerForStaff,
  resetCustomerPasswordForStaff
} = require('../controllers/staffCustomerController');
const { getStaffActivityLogs, logStaffActivity } = require('../services/activityLogService');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const router = express.Router();

// Strict Security Barrier: All staff endpoints require valid LECO Staff authorization
router.use(requireStaff);

// PDF Receipts & Audit Statements for Staff
router.get('/payments/:id/receipt-pdf', downloadPaymentReceiptPdf);
router.get('/payments/receipt-pdf', downloadPaymentReceiptPdf);
router.get('/meters/:id/statement-pdf', downloadMeterStatementPdf);
router.get('/meters/statement-pdf', downloadMeterStatementPdf);

/**
 * POST /api/staff/verify-password
 * Verifies staff password before allowing sensitive administrative operations
 */
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Password is required for security authorization.' });
    }

    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff user profile not found.' });
    }

    const isValid = await bcrypt.compare(password, userRes.rows[0].password);
    if (!isValid) {
      await logStaffActivity({
        staffId: req.user.id,
        staffEmail: req.user.email,
        actionType: 'PASSWORD_VERIFY_FAILED',
        targetEntity: 'Security Barrier',
        details: { message: 'Incorrect staff password provided during sensitive operation authorization' },
        ipAddress: req.ip || '127.0.0.1',
        status: 'failed'
      });
      return res.status(401).json({ success: false, message: 'Incorrect password. Authorization denied.' });
    }

    return res.json({ success: true, message: 'Security authorization confirmed.' });
  } catch (err) {
    console.error('[Staff Password Verify] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal authorization error.' });
  }
});

/**
 * GET /api/staff/activity-logs
 * Retrieves historical audit logs of staff operations
 */
router.get('/activity-logs', async (req, res) => {
  try {
    const { limit, actionType, search } = req.query;
    const logs = await getStaffActivityLogs({ limit, actionType, search });
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('[Staff Activity Logs] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve staff activity logs.' });
  }
});

/**
 * Customer Members Management
 */
router.get('/customers', getAllCustomersForStaff);
router.post('/customers', createCustomerForStaff);
router.post('/customers/:customerId/reset-password', resetCustomerPasswordForStaff);

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
 * Meters Management (Grid Control & Provisioning)
 */
router.get('/meters/unregistered-hardware', getUnregisteredHardwareMetersForStaff);
router.get('/meters', getAllMetersForStaff);
router.post('/meters/register', registerMeterForStaff);
router.post('/meters/:meterId/assign', assignMeterToCustomerForStaff);
router.post('/meters/:meterId/relay', toggleMeterRelay);
router.post('/meters/:meterId/topup', staffTopupMeter);
router.post('/meters/:meterId/regenerate-passcode', regenerateMeterPasscodeForStaff);

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

/**
 * Text.lk Programmable SMS Gateway & Alerts Dispatch
 */
const {
  getSmsBalance,
  getSmsProfile,
  getSmsLogs,
  sendStaffSms,
  broadcastLowBalanceAlerts,
  getTemplates
} = require('../controllers/smsController');

router.get('/sms/balance', getSmsBalance);
router.get('/sms/profile', getSmsProfile);
router.get('/sms/logs', getSmsLogs);
router.get('/sms/templates', getTemplates);
router.post('/sms/send', sendStaffSms);
router.post('/sms/broadcast-low-balance', broadcastLowBalanceAlerts);

/**
 * Nodemailer Email Gateway & SMTP Configuration
 */
const {
  getEmailConfig,
  updateEmailConfig,
  sendStaffTestEmail,
  getEmailLogs
} = require('../controllers/staffEmailController');

router.get('/email/config', getEmailConfig);
router.post('/email/config', updateEmailConfig);
router.post('/email/test', sendStaffTestEmail);
router.get('/email/logs', getEmailLogs);

/**
 * System Settings & Customer Feature Flags Management
 */
const {
  getStaffSettings,
  updateStaffSettings
} = require('../controllers/staffSettingsController');

router.get('/system-settings', getStaffSettings);
router.post('/system-settings', updateStaffSettings);

module.exports = router;
