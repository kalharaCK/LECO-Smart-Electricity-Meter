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

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum payment amount is Rs. 50.00' 
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
      `SELECT * FROM payments WHERE order_id = $1 OR transaction_id = $1`,
      [orderId]
    );

    if (payQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const payment = payQuery.rows[0];

    // If already finalized as Success, return immediately
    if (payment.status === 'Success') {
      const meterRes = await pool.query('SELECT * FROM meters WHERE id = $1', [payment.meter_id]);
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Payment already verified and credited.',
        newBalance: payment.new_balance,
        meterNumber: meterRes.rows[0]?.meter_number,
        transactionId: orderId
      });
    }

    // Retrieve associated meter
    const meterQuery = await pool.query('SELECT * FROM meters WHERE id = $1', [payment.meter_id]);
    if (meterQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Associated meter not found' });
    }
    const meter = meterQuery.rows[0];

    const currentBalance = parseFloat(meter.balance);
    const rechargeAmount = parseFloat(payment.amount);
    const newBalance = currentBalance + rechargeAmount;

    // Determine status & emergency credit settlement
    let newStatus = meter.status;
    let emergencyCreditActive = meter.emergency_credit_active;
    if (newBalance > 0) {
      newStatus = 'Connected';
      emergencyCreditActive = false;
    }

    // Update meter balance & status
    await pool.query(
      `UPDATE meters 
       SET balance = $1, status = $2, emergency_credit_active = $3 
       WHERE id = $4`,
      [newBalance, newStatus, emergencyCreditActive, meter.id]
    );

    // Update payment record to Success
    await pool.query(
      `UPDATE payments 
       SET status = 'Success', 
           new_balance = $1, 
           payhere_payment_id = COALESCE($2, payhere_payment_id, 'PH-CLIENT-' || EXTRACT(EPOCH FROM NOW())),
           verified_at = CURRENT_TIMESTAMP,
           verified_by = 'PayHere Client Handshake'
       WHERE id = $3`,
      [newBalance, paymentId || null, payment.id]
    );

    // Insert alert notification
    await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, 'success', 'PayHere Recharge Successful', $3)`,
      [
        payment.user_id,
        meter.id,
        `Payment of Rs. ${rechargeAmount.toFixed(2)} completed via PayHere. New balance: Rs. ${newBalance.toFixed(2)}.`
      ]
    );

    // Broadcast live telemetry
    emitMeterUpdate(meter.id, {
      meterId: meter.id,
      balance: newBalance,
      status: newStatus,
      emergency_credit_active: emergencyCreditActive
    });

    emitNotification(payment.user_id, {
      type: 'success',
      title: 'PayHere Recharge Successful',
      message: `Rs. ${rechargeAmount.toFixed(2)} credited to meter ${meter.meter_number}.`
    });

    // Dispatch Payment Confirmation SMS via Text.lk
    try {
      const userMobQuery = await pool.query(
        `SELECT COALESCE(u.mobile_number, s.phone_number) as phone 
         FROM users u 
         LEFT JOIN user_settings s ON u.id = s.user_id 
         WHERE u.id = $1`,
        [payment.user_id]
      );
      const customerPhone = userMobQuery.rows[0]?.phone;
      if (customerPhone) {
        smsService.sendEventSms({
          recipient: customerPhone,
          eventType: 'payment',
          language: 'en',
          data: {
            amount: rechargeAmount.toFixed(2),
            account_no: meter.account_number || meter.meter_number,
            ref: orderId,
            balance: newBalance.toFixed(2)
          }
        }).catch(err => console.error('[PayHere SMS Error]:', err.message));
      }
    } catch (smsErr) {
      console.error('[PayHere SMS User Fetch Error]:', smsErr.message);
    }

    return res.json({
      success: true,
      message: 'PayHere payment verified and credited successfully',
      newBalance,
      amount: rechargeAmount,
      meterNumber: meter.meter_number,
      transactionId: orderId,
      status: newStatus
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

    const payQuery = await pool.query(
      `SELECT * FROM payments WHERE order_id = $1 OR transaction_id = $1`,
      [order_id]
    );

    if (payQuery.rows.length === 0) {
      console.warn(`[PayHere Webhook] Order ${order_id} not found in database.`);
      return res.status(404).send('Order not found');
    }

    const payment = payQuery.rows[0];
    const code = parseInt(status_code, 10);

    if (code === 2) {
      // Payment Successful (Code 2)
      if (payment.status !== 'Success') {
        const meterQuery = await pool.query('SELECT * FROM meters WHERE id = $1', [payment.meter_id]);
        if (meterQuery.rows.length > 0) {
          const meter = meterQuery.rows[0];
          const newBalance = parseFloat(meter.balance) + parseFloat(payhere_amount);
          const newStatus = newBalance > 0 ? 'Connected' : meter.status;

          await pool.query(
            `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
            [newBalance, newStatus, meter.id]
          );

          await pool.query(
            `UPDATE payments 
             SET status = 'Success', 
                 new_balance = $1, 
                 payhere_payment_id = $2,
                 payment_method = COALESCE($3, payment_method),
                 card_holder_name = $4,
                 card_no = $5,
                 verified_at = CURRENT_TIMESTAMP,
                 verified_by = 'PayHere Verified IPN'
             WHERE id = $6`,
            [newBalance, payment_id, method, card_holder_name || null, card_no || null, payment.id]
          );

          emitMeterUpdate(meter.id, {
            meterId: meter.id,
            balance: newBalance,
            status: newStatus
          });

          // Dispatch Payment Confirmation SMS via Text.lk IPN
          try {
            const userMobQuery = await pool.query(
              `SELECT COALESCE(u.mobile_number, s.phone_number) as phone 
               FROM users u 
               LEFT JOIN user_settings s ON u.id = s.user_id 
               WHERE u.id = $1`,
              [payment.user_id]
            );
            const customerPhone = userMobQuery.rows[0]?.phone;
            if (customerPhone) {
              smsService.sendEventSms({
                recipient: customerPhone,
                eventType: 'payment',
                language: 'en',
                data: {
                  amount: parseFloat(payhere_amount).toFixed(2),
                  account_no: meter.account_number || meter.meter_number,
                  ref: payment_id || order_id,
                  balance: newBalance.toFixed(2)
                }
              }).catch(err => console.error('[PayHere IPN SMS Error]:', err.message));
            }
          } catch (smsErr) {
            console.error('[PayHere IPN SMS Error]:', smsErr.message);
          }
        }
      } else {
        // Already credited by client handshake, update PayHere gateway details
        await pool.query(
          `UPDATE payments 
           SET payhere_payment_id = COALESCE($1, payhere_payment_id),
               payment_method = COALESCE($2, payment_method),
               card_holder_name = COALESCE($3, card_holder_name),
               card_no = COALESCE($4, card_no),
               verified_by = 'PayHere Verified IPN'
           WHERE id = $5`,
          [payment_id, method, card_holder_name || null, card_no || null, payment.id]
        );
      }
    } else if (code < 0) {
      // Payment Failed (Code -1 Cancelled, -2 Failed, -3 Chargedback)
      await pool.query(
        `UPDATE payments 
         SET status = 'Failed', 
             verification_notes = $1 
         WHERE id = $2`,
        [status_message || `PayHere returned status code: ${code}`, payment.id]
      );
    }

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
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'flag' | 'reject'
    const staffEmail = req.user.email || 'Staff';

    const payQuery = await pool.query(
      `SELECT p.*, m.meter_number, m.balance AS current_meter_balance, m.status AS current_meter_status 
       FROM payments p 
       LEFT JOIN meters m ON p.meter_id = m.id 
       WHERE p.id = $1`,
      [id]
    );

    if (payQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction record not found' });
    }

    const payment = payQuery.rows[0];

    if (action === 'approve') {
      let newBalance = parseFloat(payment.current_meter_balance);
      let newStatus = payment.current_meter_status;

      // If was not yet credited, credit the meter balance
      if (payment.status !== 'Success') {
        newBalance = parseFloat(payment.current_meter_balance) + parseFloat(payment.amount);
        newStatus = newBalance > 0 ? 'Connected' : payment.current_meter_status;

        await pool.query(
          `UPDATE meters SET balance = $1, status = $2 WHERE id = $3`,
          [newBalance, newStatus, payment.meter_id]
        );
      }

      await pool.query(
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

      // Emit telemetry update
      emitMeterUpdate(payment.meter_id, {
        meterId: payment.meter_id,
        balance: newBalance,
        status: newStatus
      });

      return res.json({
        success: true,
        message: `Transaction ${payment.transaction_id} verified & approved. Balance credited to meter ${payment.meter_number}.`,
        newBalance
      });
    } else if (action === 'reject') {
      await pool.query(
        `UPDATE payments 
         SET status = 'Failed', 
             verified_at = CURRENT_TIMESTAMP, 
             verified_by = $1, 
             verification_notes = $2 
         WHERE id = $3`,
        [`Staff Auditor: ${staffEmail}`, notes || 'Rejected by LECO Staff Auditor', payment.id]
      );

      return res.json({
        success: true,
        message: `Transaction ${payment.transaction_id} marked as Rejected.`
      });
    }

    return res.status(400).json({ success: false, message: 'Valid action (approve | reject) required' });
  } catch (err) {
    console.error('[Staff PayHere Verify Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  initPayhereCheckout,
  completePayhereCheckout,
  handlePayhereNotify,
  getStaffPayhereTransactions,
  verifyStaffPayhereTransaction
};
