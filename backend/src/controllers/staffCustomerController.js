const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { logStaffActivity } = require('../services/activityLogService');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

/**
 * GET /api/staff/customers
 * Returns all registered customer members with their linked meters and details
 */
const getAllCustomersForStaff = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.mobile_number,
        u.nic,
        u.address,
        u.email_verified,
        u.role,
        u.created_at,
        COUNT(m.id)::int AS meter_count,
        COALESCE(SUM(m.balance), 0)::numeric AS total_balance,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'meter_number', m.meter_number,
              'account_number', m.account_number,
              'balance', m.balance,
              'status', m.status,
              'name', m.name
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS meters
      FROM users u
      LEFT JOIN meters m ON u.id = m.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query);
    return res.json({
      success: true,
      customers: result.rows
    });
  } catch (error) {
    console.error('[Staff Customer Controller] Error fetching customers:', error);
    return res.status(500).json({ success: false, message: 'Failed to load customers for staff.' });
  }
};

/**
 * POST /api/staff/customers
 * Registers a new customer member with optional initial smart meter assignment
 */
const createCustomerForStaff = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      mobile_number,
      nic,
      address = '',
      meter_number,
      account_number,
      initial_balance = 0,
      meter_pin = '1234'
    } = req.body;

    // Field Validations
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }
    if (!mobile_number || !mobile_number.trim()) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }
    if (!nic || !nic.trim()) {
      return res.status(400).json({ success: false, message: 'National Identity Card (NIC) number is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile_number.trim();
    const cleanNic = nic.trim().toUpperCase();

    // Check existing email
    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // Check existing mobile
    const mobileCheck = await pool.query(
      'SELECT id FROM users WHERE mobile_number = $1 OR RIGHT(mobile_number, 9) = RIGHT($2, 9)',
      [cleanMobile, cleanMobile]
    );
    if (mobileCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
    }

    // Check existing NIC
    const nicCheck = await pool.query('SELECT id FROM users WHERE UPPER(nic) = $1', [cleanNic]);
    if (nicCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this NIC number already exists.' });
    }

    // If meter number provided, check uniqueness
    const cleanMeterNumber = meter_number ? meter_number.trim() : null;
    if (cleanMeterNumber) {
      const meterCheck = await pool.query('SELECT id FROM meters WHERE meter_number = $1', [cleanMeterNumber]);
      if (meterCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: `Smart meter ${cleanMeterNumber} is already registered.` });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create customer record
    const userInsert = await pool.query(
      `INSERT INTO users (email, password, role, full_name, address, mobile_number, nic, email_verified)
       VALUES ($1, $2, 'customer', $3, $4, $5, $6, TRUE)
       RETURNING id, email, role, full_name, address, mobile_number, nic, email_verified, created_at`,
      [cleanEmail, hashedPassword, full_name.trim(), address ? address.trim() : '', cleanMobile, cleanNic]
    );
    const newCustomer = userInsert.rows[0];

    // Create user settings
    await pool.query(
      `INSERT INTO user_settings (user_id, phone_number, low_balance_threshold, daily_spike_threshold, bill_reminder_enabled, sms_notifications, weekly_report)
       VALUES ($1, $2, 300.00, 15.00, TRUE, TRUE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [newCustomer.id, cleanMobile]
    );

    let linkedMeter = null;
    if (cleanMeterNumber) {
      const cleanAcc = account_number && account_number.trim() 
        ? account_number.trim() 
        : `ACC-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const numBalance = parseFloat(initial_balance) || 0;
      const hashedPin = await bcrypt.hash(String(meter_pin || '1234'), 10);

      const meterInsert = await pool.query(
        `INSERT INTO meters (user_id, meter_number, account_number, pin, balance, status, name)
         VALUES ($1, $2, $3, $4, $5, 'Connected', 'Main Residence')
         RETURNING id, meter_number, account_number, balance, status, name`,
        [newCustomer.id, cleanMeterNumber, cleanAcc, hashedPin, numBalance]
      );
      linkedMeter = meterInsert.rows[0];

      if (numBalance > 0) {
        await pool.query(
          `INSERT INTO payments (user_id, meter_id, amount, payment_method, transaction_id, previous_balance, new_balance, status)
           VALUES ($1, $2, $3, 'Staff Initial Credit', $4, 0, $5, 'Success')`,
          [newCustomer.id, linkedMeter.id, numBalance, `ONBOARD-${Date.now()}`, numBalance]
        );
      }
    }

    // Log traceable staff action
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail: req.user?.email || 'staff@leco.lk',
      actionType: 'CREATE_CUSTOMER_MEMBER',
      targetEntity: `Customer #${newCustomer.id} (${cleanEmail})`,
      details: {
        customerId: newCustomer.id,
        email: cleanEmail,
        fullName: full_name.trim(),
        mobileNumber: cleanMobile,
        nic: cleanNic,
        linkedMeter: linkedMeter ? linkedMeter.meter_number : null,
        initialBalance: initial_balance
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

    // Optional notification dispatch (non-blocking)
    try {
      smsService.sendEventSms({
        recipient: cleanMobile,
        eventType: 'customer_registered',
        language: 'en',
        data: {
          name: full_name.trim(),
          email: cleanEmail
        }
      }).catch(err => console.warn('[Staff Customer] Welcome SMS notice:', err.message));
    } catch (_) {}

    try {
      emailService.sendHtmlEmail({
        to: cleanEmail,
        subject: 'Welcome to LECO Smart Electricity Prepayment',
        purpose: 'account_created',
        htmlBody: emailService.buildCustomerWelcomeEmailHtml({
          fullName: full_name.trim(),
          email: cleanEmail,
          nic: cleanNic,
          meter: linkedMeter
        })
      }).catch(err => console.warn('[Staff Customer] Welcome Email notice:', err.message));
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: 'New customer member created successfully.',
      customer: {
        ...newCustomer,
        meter: linkedMeter
      }
    });
  } catch (err) {
    console.error('[Staff Customer Controller] Error registering customer:', err);
    return res.status(500).json({ success: false, message: 'Failed to create customer member.' });
  }
};

module.exports = {
  getAllCustomersForStaff,
  createCustomerForStaff
};
