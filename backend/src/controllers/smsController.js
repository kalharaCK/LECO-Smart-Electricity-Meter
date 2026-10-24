const smsService = require('../services/smsService');
const { pool } = require('../config/db');

/**
 * GET /api/staff/sms/balance
 * Returns live Text.lk remaining units and account balance
 */
const getSmsBalance = async (req, res) => {
  try {
    const data = await smsService.getBalance();
    return res.json({
      success: true,
      balance: data
    });
  } catch (err) {
    console.error('[SMS Controller] Error fetching balance:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/staff/sms/profile
 * Returns Text.lk registered account profile
 */
const getSmsProfile = async (req, res) => {
  try {
    const data = await smsService.getProfile();
    return res.json({
      success: true,
      profile: data
    });
  } catch (err) {
    console.error('[SMS Controller] Error fetching profile:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/staff/sms/logs
 * Returns persisted SMS dispatch records and delivery statistics
 */
const getSmsLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const eventType = req.query.eventType || null;

    const data = await smsService.getSmsLogs({ limit, offset, eventType });
    return res.json(data);
  } catch (err) {
    console.error('[SMS Controller] Error fetching SMS logs:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/staff/sms/send
 * Staff sends a direct custom or templated SMS to a customer
 */
const sendStaffSms = async (req, res) => {
  try {
    const { recipient, message, template, templateData, language = 'en', eventType = 'custom' } = req.body;

    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Recipient mobile number is required' });
    }

    let finalMessage = message;
    if (template && (!finalMessage || !finalMessage.trim())) {
      finalMessage = smsService.formatMessage(template, language, templateData || {});
    }

    if (!finalMessage || !finalMessage.trim()) {
      return res.status(400).json({ success: false, error: 'Message content or valid template is required' });
    }

    const result = await smsService.sendSms({
      recipient,
      message: finalMessage,
      eventType,
      language,
      metadata: { sent_by_staff: req.user?.email || 'staff' }
    });

    return res.json(result);
  } catch (err) {
    console.error('[SMS Controller] Error sending SMS:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/staff/sms/broadcast-low-balance
 * Scans all smart meters with balance <= threshold and triggers low balance SMS
 */
const broadcastLowBalanceAlerts = async (req, res) => {
  try {
    const thresholdParam = parseFloat(req.body.threshold) || null;
    const language = req.body.language || 'en';

    // Find meters with balance <= user_settings.low_balance_threshold or custom threshold
    const query = `
      SELECT 
        m.id AS meter_id,
        m.meter_number,
        m.account_number,
        m.balance,
        u.id AS user_id,
        COALESCE(u.mobile_number, us.phone_number) AS mobile_number,
        COALESCE(us.low_balance_threshold, 300.00) AS low_balance_threshold
      FROM meters m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE m.balance <= COALESCE($1, us.low_balance_threshold, 300.00)
    `;

    const result = await pool.query(query, [thresholdParam]);
    const lowBalanceMeters = result.rows.filter(r => !!r.mobile_number);

    const dispatchResults = [];
    for (const meter of lowBalanceMeters) {
      const smsRes = await smsService.sendEventSms({
        recipient: meter.mobile_number,
        eventType: 'low_balance',
        language: language,
        data: {
          account_no: meter.account_number || meter.meter_number,
          balance: parseFloat(meter.balance).toFixed(2)
        },
        metadata: { meter_id: meter.meter_id, batch: 'staff_broadcast' }
      });
      dispatchResults.push({
        meterNumber: meter.meter_number,
        recipient: meter.mobile_number,
        balance: meter.balance,
        success: smsRes.success,
        status: smsRes.status
      });
    }

    return res.json({
      success: true,
      scannedMetersCount: result.rows.length,
      smsDispatchedCount: lowBalanceMeters.length,
      dispatches: dispatchResults
    });
  } catch (err) {
    console.error('[SMS Controller] Error broadcasting low balance SMS:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/staff/sms/templates
 * Returns available SMS templates in all 3 languages (English, Sinhala, Tamil)
 */
const getTemplates = (req, res) => {
  return res.json({
    success: true,
    languages: [
      { code: 'en', label: 'English' },
      { code: 'si', label: 'සිංහල (Sinhala)' },
      { code: 'ta', label: 'தமிழ் (Tamil)' }
    ],
    templates: [
      {
        id: 'low_balance',
        name: 'Low Balance Warning',
        placeholders: ['account_no', 'balance'],
        examples: {
          en: smsService.formatMessage('low_balance', 'en', { account_no: 'ACC-883921', balance: '120.00' }),
          si: smsService.formatMessage('low_balance', 'si', { account_no: 'ACC-883921', balance: '120.00' }),
          ta: smsService.formatMessage('low_balance', 'ta', { account_no: 'ACC-883921', balance: '120.00' })
        }
      },
      {
        id: 'payment',
        name: 'Payment Receipt',
        placeholders: ['account_no', 'amount', 'ref', 'balance'],
        examples: {
          en: smsService.formatMessage('payment', 'en', { account_no: 'ACC-883921', amount: '1500.00', ref: 'PAY-1002', balance: '1620.00' }),
          si: smsService.formatMessage('payment', 'si', { account_no: 'ACC-883921', amount: '1500.00', ref: 'PAY-1002', balance: '1620.00' }),
          ta: smsService.formatMessage('payment', 'ta', { account_no: 'ACC-883921', amount: '1500.00', ref: 'PAY-1002', balance: '1620.00' })
        }
      },
      {
        id: 'login_attempt',
        name: 'Login Attempt Alert',
        placeholders: ['time'],
        examples: {
          en: smsService.formatMessage('login_attempt', 'en', { time: '14:30' }),
          si: smsService.formatMessage('login_attempt', 'si', { time: '14:30' }),
          ta: smsService.formatMessage('login_attempt', 'ta', { time: '14:30' })
        }
      },
      {
        id: 'otp_registration',
        name: 'Registration OTP',
        placeholders: ['otp'],
        examples: {
          en: smsService.formatMessage('otp_registration', 'en', { otp: '482910' }),
          si: smsService.formatMessage('otp_registration', 'si', { otp: '482910' }),
          ta: smsService.formatMessage('otp_registration', 'ta', { otp: '482910' })
        }
      },
      {
        id: 'otp_forgot_password',
        name: 'Password Reset OTP',
        placeholders: ['otp'],
        examples: {
          en: smsService.formatMessage('otp_forgot_password', 'en', { otp: '719302' }),
          si: smsService.formatMessage('otp_forgot_password', 'si', { otp: '719302' }),
          ta: smsService.formatMessage('otp_forgot_password', 'ta', { otp: '719302' })
        }
      },
      {
        id: 'relay_command',
        name: 'Relay Power Supply Alert',
        placeholders: ['account_no', 'status'],
        examples: {
          en: smsService.formatMessage('relay_command', 'en', { account_no: 'ACC-883921', status: 'Connected' }),
          si: smsService.formatMessage('relay_command', 'si', { account_no: 'ACC-883921', status: 'සම්බන්ධ' }),
          ta: smsService.formatMessage('relay_command', 'ta', { account_no: 'ACC-883921', status: 'இணைக்கப்பட்டது' })
        }
      }
    ]
  });
};

module.exports = {
  getSmsBalance,
  getSmsProfile,
  getSmsLogs,
  sendStaffSms,
  broadcastLowBalanceAlerts,
  getTemplates
};
