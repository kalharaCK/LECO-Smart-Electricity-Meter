const { pool } = require('../config/db');
const { 
  getMerchantConfig, 
  generateCheckoutHash, 
  verifyNotificationSignature 
} = require('../services/payhereService');
const { emitMeterUpdate, emitNotification } = require('../services/socketService');
const smsService = require('../services/smsService');

/**
 * 1. Initialize PayHere Checkout Session
 * Called by customer frontend before opening payhere.js popup
 * POST /api/customer/payments/payhere-init
 */
const initPayhereCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meterId, amount } = req.body;

    const amountText = typeof amount === 'number' ? String(amount) : amount;
    const numAmount = Number(amountText);
    if (typeof amountText !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
        !Number.isFinite(numAmount) || numAmount < 50 || numAmount > 100000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment amount must be between Rs. 50 and Rs. 100,000 with at most two decimal places.' 
      });
    }

    if (!meterId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid Smart Meter ID is required.' 
      });
    }

    // Verify meter belongs to customer (or user is staff)
    const meterQuery = await pool.query(
      `SELECT id, meter_number, account_number, balance, status, emergency_credit_active, emergency_credit_limit 
       FROM meters 
       WHERE id = $1 AND (user_id = $2 OR $3 = 'staff' OR $3 = 'admin')`,
      [meterId, userId, req.user.role]
    );

    if (meterQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Meter not found or unauthorized access.' 
      });
    }

    const meter = meterQuery.rows[0];

    // Fetch customer details from user and user_settings
    const userQuery = await pool.query(
      `SELECT u.email, COALESCE(s.phone_number, '+94 77 123 4567') as phone
       FROM users u
       LEFT JOIN user_settings s ON u.id = s.user_id
       WHERE u.id = $1`,
      [userId]
    );

    const user = userQuery.rows[0] || { email: req.user.email, phone: '+94 77 123 4567' };
    const emailParts = user.email.split('@')[0].split('.');
    const firstName = emailParts[0] ? (emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1)) : 'Customer';
    const lastName = emailParts[1] ? (emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1)) : 'User';

    // Generate unique merchant order ID
    const orderId = `LECO-ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate PayHere Checkout Hash
    const { merchantId, amountFormatted, currency, hash } = generateCheckoutHash(orderId, numAmount, 'LKR');
    const { isSandbox, frontendUrl, backendUrl } = getMerchantConfig();

    // Insert pending payment record into ledger
    await pool.query(
      `INSERT INTO payments (
         user_id, meter_id, amount, payment_method, transaction_id, 
         previous_balance, new_balance, status, order_id, 
         payhere_currency, payment_gateway
       )
       VALUES ($1, $2, $3, 'PayHere Online', $4, $5, $5, 'Pending', $4, $6, 'PayHere')`,
      [userId, meter.id, numAmount, orderId, meter.balance, currency]
    );

    // Prepare parameters for payhere.js popup
    const payherePayment = {
      sandbox: isSandbox,
      merchant_id: merchantId,
      return_url: `${frontendUrl}/?payment=success&order_id=${orderId}`,
      cancel_url: `${frontendUrl}/?payment=cancelled&order_id=${orderId}`,
      notify_url: `${backendUrl}/api/payments/payhere-notify`,
      order_id: orderId,
      items: `LECO Smart Electricity Recharge - ${meter.meter_number}`,
      amount: amountFormatted,
      currency: currency,
      hash: hash,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      phone: user.phone.replace(/[^0-9]/g, '').slice(-10) || '0771234567',
      address: 'LECO Customer Service Area',
      city: 'Colombo',
      country: 'Sri Lanka',
      custom_1: meter.id.toString(),
      custom_2: userId.toString()
    };

    return res.json({
      success: true,
      message: 'PayHere session initialized',
      orderId,
      payhere: payherePayment
    });
  } catch (err) {
    console.error('[PayHere Init Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 2. Complete PayHere Checkout from Frontend Handshake
 * Called when payhere.onCompleted fires in customer browser
 * POST /api/customer/payments/payhere-complete
 */
const completePayhereCheckout = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const payQuery = await pool.query(
      `SELECT p.status, p.amount, p.previous_balance, p.new_balance, p.order_id,
              p.transaction_id, p.meter_id, m.meter_number
       FROM payments p JOIN meters m ON m.id = p.meter_id
       WHERE p.order_id = $1 AND p.user_id = $2`,
      [orderId, req.user.id]
    );

    if (payQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const payment = payQuery.rows[0];

    if (payment.status !== 'Success') {
      return res.status(payment.status === 'Pending' ? 202 : 409).json({
        success: false,
        status: payment.status,
        message: payment.status === 'Pending'
          ? 'Payment is awaiting PayHere confirmation. Check the transaction history shortly.'
          : 'This payment was not successful.'
      });
    }

    return res.json({
      success: true,
      message: 'PayHere payment verified and credited successfully',
      payment: {
        status: payment.status,
        prevBalance: payment.previous_balance,
        newBalance: payment.new_balance,
        amount: payment.amount,
        meterNumber: payment.meter_number,
        orderId: payment.order_id || payment.transaction_id,
        paymentId
      }
    });
  } catch (err) {
    console.error('[PayHere Complete Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 3. PayHere Server-to-Server IPN Notification Webhook
 * Direct callback from PayHere payment gateway
 * POST /api/payments/payhere-notify (application/x-www-form-urlencoded)
 */
const handlePayhereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      method,
      status_message,
      card_holder_name,
      card_no
    } = req.body;

    console.log(`[PayHere Webhook] Received notification for Order: ${order_id}, Status: ${status_code}, Amount: ${payhere_amount}`);

    // Verify MD5 signature
    const merchantConfig = getMerchantConfig();
    if (!order_id || !payment_id || merchant_id !== merchantConfig.merchantId ||
        !payhere_amount || !payhere_currency || status_code === undefined || !md5sig) {
      return res.status(400).send('Missing or invalid payment notification fields');
    }

    const verification = verifyNotificationSignature({
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig
    });

    if (!verification.isValid) {
      console.warn(`[PayHere Webhook] Security Alert: Invalid MD5 signature for Order: ${order_id}`);
      return res.status(400).send('Invalid signature checksum');
    }

    const code = parseInt(status_code, 10);
    const client = await pool.connect();
    let emittedUpdate = null;
    let emittedNotification = null;
    try {
      await client.query('BEGIN');
      const payQuery = await client.query(
        `SELECT * FROM payments WHERE order_id = $1 FOR UPDATE`, [order_id]
      );
      if (payQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).send('Order not found');
      }
      const payment = payQuery.rows[0];
      if (payment.payment_gateway !== 'PayHere' ||
          Number(payment.amount).toFixed(2) !== Number(payhere_amount).toFixed(2) ||
          payment.payhere_currency !== payhere_currency) {
        await client.query('ROLLBACK');
        return res.status(400).send('Payment details do not match the order');
      }

      if (code === 2 && payment.status !== 'Success') {
        if (payment.status !== 'Pending') {
          await client.query('ROLLBACK');
          return res.status(409).send('Order is not awaiting payment');
        }
        const meterQuery = await client.query('SELECT * FROM meters WHERE id = $1 FOR UPDATE', [payment.meter_id]);
        if (!meterQuery.rows.length) throw new Error('Payment meter not found');
        const meter = meterQuery.rows[0];
        const newBalance = Number(meter.balance) + Number(payment.amount);
        const newStatus = newBalance > 0 ? 'Connected' : meter.status;
        const emergencyActive = newBalance > 0 ? false : meter.emergency_credit_active;
        await client.query(
          'UPDATE meters SET balance = $1, status = $2, emergency_credit_active = $3 WHERE id = $4',
          [newBalance, newStatus, emergencyActive, meter.id]
        );
        await client.query(
          `UPDATE payments SET status = 'Success', new_balance = $1,
             payhere_payment_id = $2, payment_method = COALESCE($3, payment_method),
             card_holder_name = $4, card_no = $5, verified_at = CURRENT_TIMESTAMP,
             verified_by = 'PayHere Verified IPN' WHERE id = $6`,
          [newBalance, payment_id, method, card_holder_name || null, card_no || null, payment.id]
        );
        const message = `Payment of Rs. ${Number(payment.amount).toFixed(2)} completed via PayHere. New balance: Rs. ${newBalance.toFixed(2)}.`;
        await client.query(
          `INSERT INTO notifications (user_id, meter_id, type, title, message)
           VALUES ($1, $2, 'success', 'PayHere Recharge Successful', $3)`,
          [payment.user_id, meter.id, message]
        );
        emittedUpdate = { meterId: meter.id, balance: newBalance, status: newStatus, emergency_credit_active: emergencyActive };
        emittedNotification = { userId: payment.user_id, message, meterNumber: meter.meter_number };
      } else if (code === 2) {
        await client.query(
          `UPDATE payments SET payhere_payment_id = COALESCE($1, payhere_payment_id),
           payment_method = COALESCE($2, payment_method), card_holder_name = COALESCE($3, card_holder_name),
           card_no = COALESCE($4, card_no), verified_by = 'PayHere Verified IPN' WHERE id = $5`,
          [payment_id, method, card_holder_name || null, card_no || null, payment.id]
        );
      } else if (code < 0 && payment.status === 'Pending') {
        await client.query(
          `UPDATE payments SET status = 'Failed', verification_notes = $1 WHERE id = $2`,
          [status_message || `PayHere returned status code: ${code}`, payment.id]
        );
      }
      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    if (emittedUpdate) emitMeterUpdate(emittedUpdate.meterId, emittedUpdate);
    if (emittedNotification) emitNotification(emittedNotification.userId, {
      type: 'success', title: 'PayHere Recharge Successful', message: emittedNotification.message
    });

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PayHere Webhook Error]:', err);
    return res.status(500).send('Server Error');
  }
};

/**
 * 4. Staff API: Get all PayHere transactions with verification details
 * GET /api/staff/payments/payhere-transactions
 */
const getStaffPayhereTransactions = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.user_id,
        p.meter_id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.order_id,
        p.payhere_payment_id,
        p.payhere_currency,
        p.previous_balance,
        p.new_balance,
        p.status,
        p.card_holder_name,
        p.card_no,
        p.payment_gateway,
        p.verified_at,
        p.verified_by,
        p.verification_notes,
        p.created_at,
        m.meter_number,
        m.account_number,
        m.name AS meter_name,
        m.status AS meter_status,
        u.email AS customer_email
      FROM payments p
      LEFT JOIN meters m ON p.meter_id = m.id
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    return res.json({
      success: true,
      transactions: result.rows
    });
  } catch (err) {
    console.error('[Staff PayHere Transactions Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 5. Staff API: Verify or Manual Override PayHere Transaction
 * POST /api/staff/payments/:id/verify-payhere
 */
const verifyStaffPayhereTransaction = async (req, res) => {
  let client;
  let transactionStarted = false;
  let meterUpdate = null;
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'flag' | 'reject'
    const staffEmail = req.user.email || 'Staff';
    const paymentId = Number(id);
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ success: false, message: 'Valid transaction ID is required' });
    }
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, message: 'Valid action (approve | reject) required' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const payQuery = await client.query(
      `SELECT p.*, m.meter_number, m.balance AS current_meter_balance, m.status AS current_meter_status 
       FROM payments p 
       LEFT JOIN meters m ON p.meter_id = m.id 
       WHERE p.id = $1 FOR UPDATE OF p`,
      [paymentId]
    );

    if (payQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, message: 'Transaction record not found' });
    }

    const payment = payQuery.rows[0];

    if (action === 'approve') {
      let newBalance = Number(payment.new_balance);
      let newStatus = payment.current_meter_status;

      // If was not yet credited, credit the meter balance
      if (payment.status !== 'Success') {
        const meterQuery = await client.query(
          'SELECT id, balance, status FROM meters WHERE id = $1 FOR UPDATE',
          [payment.meter_id]
        );
        if (!meterQuery.rows.length) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(404).json({ success: false, message: 'Payment meter not found' });
        }
        const meter = meterQuery.rows[0];
        newBalance = Number((Number(meter.balance) + Number(payment.amount)).toFixed(2));
        newStatus = newBalance > 0 ? 'Connected' : meter.status;

        await client.query(
          `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
          [newBalance, newStatus, payment.meter_id]
        );
        meterUpdate = { meterId: payment.meter_id, balance: newBalance, status: newStatus };
      }

      if (payment.status !== 'Success') await client.query(
        `UPDATE payments 
         SET status = 'Success', 
             new_balance = $1, 
             verified_at = CURRENT_TIMESTAMP, 
             verified_by = $2,
             verification_notes = $3
         WHERE id = $4`,
        [
          newBalance,
          `Staff Auditor: ${staffEmail}`,
          notes || 'Manually verified and confirmed by LECO Operations Staff',
          payment.id
        ]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      if (meterUpdate) emitMeterUpdate(payment.meter_id, meterUpdate);

      return res.json({
        success: true,
        message: `Transaction ${payment.transaction_id} verified & approved. Balance credited to meter ${payment.meter_number}.`,
        newBalance
      });
    } else if (action === 'reject') {
      if (payment.status === 'Success') {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(409).json({ success: false, message: 'A successful payment cannot be rejected' });
      }
      await client.query(
        `UPDATE payments 
         SET status = 'Failed', 
             verified_at = CURRENT_TIMESTAMP, 
             verified_by = $1, 
             verification_notes = $2 
         WHERE id = $3`,
        [`Staff Auditor: ${staffEmail}`, notes || 'Rejected by LECO Staff Auditor', payment.id]
      );
      await client.query('COMMIT');
      transactionStarted = false;

      return res.json({
        success: true,
        message: `Transaction ${payment.transaction_id} marked as Rejected.`
      });
    }

  } catch (err) {
    console.error('[Staff PayHere Verify Error]:', err);
    if (transactionStarted && client) await client.query('ROLLBACK').catch(() => undefined);
    return res.status(500).json({ success: false, error: 'Unable to update the payment record.' });
  } finally {
    client?.release();
  }
};

module.exports = {
  initPayhereCheckout,
  completePayhereCheckout,
  handlePayhereNotify,
  getStaffPayhereTransactions,
  verifyStaffPayhereTransaction
};
