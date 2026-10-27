/**
 * PDF Report & Receipt Download Controller
 * Provides authenticated REST endpoints for on-demand generation and streaming
 * of official standard-formatted payment receipts and monthly consumption statements.
 */

const { pool, resilientQuery } = require('../config/db');
const { buildPaymentReceiptPdf, buildMeterStatementPdf } = require('../services/pdfReportService');

/**
 * GET /api/payments/:id/receipt-pdf
 * Download or view official PDF payment receipt
 */
const downloadPaymentReceiptPdf = async (req, res) => {
  try {
    const identifier = req.params.id || req.query.transaction_id || req.query.id;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Payment identifier or transaction_id is required' });
    }

    const isNumericId = /^\d+$/.test(identifier);
    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.meter_id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.order_id,
        p.payhere_payment_id,
        p.previous_balance,
        p.new_balance,
        p.status,
        p.created_at,
        p.card_holder_name,
        p.card_no,
        m.meter_number,
        m.account_number,
        m.name as meter_name,
        m.balance as current_meter_balance,
        u.email as customer_email,
        u.full_name as customer_name,
        COALESCE(u.mobile_number, s.phone_number) as mobile_number,
        COALESCE(s.tariff_type, 'Domestic D-1 (PUCSL Block Tariff)') as tariff_type
      FROM payments p
      LEFT JOIN meters m ON p.meter_id = m.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN user_settings s ON u.id = s.user_id
      WHERE ${isNumericId ? 'p.id = $1 OR p.transaction_id = $2 OR p.order_id = $2' : 'p.transaction_id = $1 OR p.order_id = $1'}
    `;

    const params = isNumericId ? [Number(identifier), identifier] : [identifier];
    const result = await resilientQuery(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    const payment = result.rows[0];

    // Customer role security check: customers can only access their own receipts
    const userRole = (req.user?.role || '').toLowerCase();
    const isStaff = userRole === 'staff' || userRole === 'admin';
    if (!isStaff && req.user && payment.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own payment receipts' });
    }

    const pdfBuffer = await buildPaymentReceiptPdf(payment);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="LECO-Receipt-${payment.transaction_id || payment.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[PDF Receipt Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate payment receipt PDF' });
  }
};

/**
 * GET /api/meters/:id/statement-pdf
 * Download or view official PDF monthly consumption & billing statement
 */
const downloadMeterStatementPdf = async (req, res) => {
  try {
    const meterIdentifier = req.params.id || req.query.meter_number || req.query.meter_id;
    if (!meterIdentifier) {
      return res.status(400).json({ success: false, error: 'Meter ID or meter_number is required' });
    }

    const isNumericId = /^\d+$/.test(meterIdentifier);
    const meterQuery = `
      SELECT 
        m.id,
        m.user_id,
        m.meter_number,
        m.account_number,
        m.balance,
        m.status,
        m.name,
        m.daily_average,
        m.emergency_credit_limit,
        m.emergency_credit_active,
        u.email as customer_email,
        u.full_name,
        COALESCE(u.mobile_number, s.phone_number) as mobile_number,
        COALESCE(s.tariff_type, 'Domestic D-1 (PUCSL Block Tariff)') as tariff_type
      FROM meters m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN user_settings s ON u.id = s.user_id
      WHERE ${isNumericId ? 'm.id = $1 OR m.meter_number = $2' : 'm.meter_number = $1'}
    `;

    const meterParams = isNumericId ? [Number(meterIdentifier), meterIdentifier] : [meterIdentifier];
    const meterRes = await resilientQuery(meterQuery, meterParams);

    if (meterRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Smart meter not found' });
    }

    const meter = meterRes.rows[0];

    // Customer role security check
    const userRole = (req.user?.role || '').toLowerCase();
    const isStaff = userRole === 'staff' || userRole === 'admin';
    if (!isStaff && req.user && meter.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view statements for your own meters' });
    }

    // Fetch 30 days of consumption logs
    const logsRes = await resilientQuery(
      `SELECT reading_date, reading_hour, consumption, energy_export
       FROM consumption_logs
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY reading_date DESC, reading_hour ASC`,
      [meter.id]
    );

    // Fetch recent payments for this meter
    const paymentsRes = await resilientQuery(
      `SELECT transaction_id, amount, payment_method, previous_balance, new_balance, status, created_at
       FROM payments
       WHERE meter_id = $1 AND status = 'Success'
       ORDER BY created_at DESC
       LIMIT 6`,
      [meter.id]
    );

    const now = new Date();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const periodLabel = `01 ${currentMonthName} - 30 ${currentMonthName}`;

    const statementData = {
      meter,
      user: {
        full_name: meter.full_name,
        email: meter.customer_email,
        mobile_number: meter.mobile_number
      },
      logs: logsRes.rows,
      payments: paymentsRes.rows,
      periodLabel
    };

    const pdfBuffer = await buildMeterStatementPdf(statementData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="LECO-Statement-${meter.meter_number}-${now.toISOString().slice(0, 10)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=1800');

    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[PDF Statement Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate consumption statement PDF' });
  }
};

module.exports = {
  downloadPaymentReceiptPdf,
  downloadMeterStatementPdf
};
