const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { sanitizeString } = require('../middlewares/sanitizer');
const { emitNotification } = require('../services/socketService');

/**
 * Get current settings, user profile, and linked meters
 * GET /api/settings
 */
const getUserSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user basic profile
    const userRes = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRes.rows[0];

    // 2. Fetch or initialize user_settings row
    let settingsRes = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (settingsRes.rows.length === 0) {
      settingsRes = await pool.query(
        `INSERT INTO user_settings (user_id) 
         VALUES ($1) 
         RETURNING *`,
        [userId]
      );
    }
    const settings = settingsRes.rows[0];

    // 3. Fetch user meters
    const metersRes = await pool.query(
      `SELECT id, meter_number, account_number, name, balance, status, 
              emergency_credit_limit, emergency_credit_active, emergency_credit_activated_at
       FROM meters
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    return res.json({
      success: true,
      settings: {
        phone_number: settings.phone_number,
        low_balance_threshold: parseFloat(settings.low_balance_threshold || 300),
        daily_kwh_budget: parseFloat(settings.daily_kwh_budget || 12),
        auto_emergency_credit: settings.auto_emergency_credit,
        night_curfew_enabled: settings.night_curfew_enabled,
        email_notifications: settings.email_notifications,
        sms_notifications: settings.sms_notifications,
        weekly_report: settings.weekly_report,
        tariff_type: settings.tariff_type,
        updated_at: settings.updated_at
      },
      user,
      meters: metersRes.rows
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ success: false, message: 'Internal server error fetching settings' });
  }
};

/**
 * Update user preferences and alert thresholds
 * PATCH /api/settings
 */
const updateUserSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      phone_number,
      low_balance_threshold,
      daily_kwh_budget,
      auto_emergency_credit,
      night_curfew_enabled,
      email_notifications,
      sms_notifications,
      weekly_report
    } = req.body;

    const parsedThreshold = low_balance_threshold !== undefined ? parseFloat(low_balance_threshold) : null;
    const parsedBudget = daily_kwh_budget !== undefined ? parseFloat(daily_kwh_budget) : null;

    if (parsedThreshold !== null && (isNaN(parsedThreshold) || parsedThreshold < 0)) {
      return res.status(400).json({ success: false, message: 'Low balance threshold must be a positive number' });
    }

    if (parsedBudget !== null && (isNaN(parsedBudget) || parsedBudget <= 0)) {
      return res.status(400).json({ success: false, message: 'Daily kWh budget must be greater than zero' });
    }

    const cleanPhone = phone_number ? sanitizeString(phone_number, 20) : null;

    const updateRes = await pool.query(
      `INSERT INTO user_settings (
        user_id,
        phone_number,
        low_balance_threshold,
        daily_kwh_budget,
        auto_emergency_credit,
        night_curfew_enabled,
        email_notifications,
        sms_notifications,
        weekly_report,
        updated_at
      ) VALUES ($1, COALESCE($2, '+94 77 123 4567'), COALESCE($3, 300), COALESCE($4, 12), COALESCE($5, TRUE), COALESCE($6, TRUE), COALESCE($7, TRUE), COALESCE($8, TRUE), COALESCE($9, TRUE), CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        phone_number = COALESCE($2, user_settings.phone_number),
        low_balance_threshold = COALESCE($3, user_settings.low_balance_threshold),
        daily_kwh_budget = COALESCE($4, user_settings.daily_kwh_budget),
        auto_emergency_credit = COALESCE($5, user_settings.auto_emergency_credit),
        night_curfew_enabled = COALESCE($6, user_settings.night_curfew_enabled),
        email_notifications = COALESCE($7, user_settings.email_notifications),
        sms_notifications = COALESCE($8, user_settings.sms_notifications),
        weekly_report = COALESCE($9, user_settings.weekly_report),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        cleanPhone,
        parsedThreshold,
        parsedBudget,
        auto_emergency_credit,
        night_curfew_enabled,
        email_notifications,
        sms_notifications,
        weekly_report
      ]
    );

    const updated = updateRes.rows[0];

    // Create confirmation notification
    const notifRes = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'info', 'Preferences Saved', 'Your smart meter alert preferences and threshold settings were updated successfully.')
       RETURNING *`,
      [userId]
    );
    if (notifRes.rows.length > 0) {
      emitNotification(userId, notifRes.rows[0]);
    }

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      settings: {
        phone_number: updated.phone_number,
        low_balance_threshold: parseFloat(updated.low_balance_threshold),
        daily_kwh_budget: parseFloat(updated.daily_kwh_budget),
        auto_emergency_credit: updated.auto_emergency_credit,
        night_curfew_enabled: updated.night_curfew_enabled,
        email_notifications: updated.email_notifications,
        sms_notifications: updated.sms_notifications,
        weekly_report: updated.weekly_report,
        tariff_type: updated.tariff_type,
        updated_at: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ success: false, message: 'Internal server error saving settings' });
  }
};

/**
 * Change Account Password
 * PATCH /api/settings/password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentHash = userRes.rows[0].password;
    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userId]);

    // Create security notification
    const notifRes = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'alert', 'Password Changed', 'Your LECO account password was updated. If you did not make this change, please contact LECO immediately.')
       RETURNING *`,
      [userId]
    );
    if (notifRes.rows.length > 0) {
      emitNotification(userId, notifRes.rows[0]);
    }

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Internal server error changing password' });
  }
};

/**
 * Update 4-Digit Smart Meter Hardware PIN
 * PATCH /api/settings/meter-pin
 */
const updateMeterPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meterId, newPin } = req.body;

    if (!meterId || !newPin) {
      return res.status(400).json({ success: false, message: 'Meter ID and new 4-digit PIN are required' });
    }

    const pinStr = String(newPin).trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return res.status(400).json({ success: false, message: 'PIN must consist of exactly 4 digits (e.g. 1234)' });
    }

    // Verify meter ownership
    const meterRes = await pool.query('SELECT id, meter_number FROM meters WHERE id = $1 AND user_id = $2', [meterId, userId]);
    if (meterRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Smart meter not found or unauthorized' });
    }

    // Phase 2 Cryptographic Hashing
    const hashedPin = await bcrypt.hash(pinStr, 10);
    await pool.query('UPDATE meters SET pin = $1 WHERE id = $2', [hashedPin, meterId]);

    // Create notification
    const notifRes = await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, 'info', 'Meter PIN Updated', 'Hardware security PIN for meter ${meterRes.rows[0].meter_number} was successfully updated.')
       RETURNING *`,
      [userId, meterId]
    );
    if (notifRes.rows.length > 0) {
      emitNotification(userId, notifRes.rows[0]);
    }

    return res.json({ success: true, message: `Hardware PIN for meter ${meterRes.rows[0].meter_number} updated successfully` });
  } catch (error) {
    console.error('Error updating meter PIN:', error);
    return res.status(500).json({ success: false, message: 'Internal server error updating meter PIN' });
  }
};

/**
 * Update Meter Alias / Friendly Name
 * PATCH /api/settings/meter-name
 */
const updateMeterAlias = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meterId, name } = req.body;

    if (!meterId || !name) {
      return res.status(400).json({ success: false, message: 'Meter ID and valid name are required' });
    }

    const cleanName = sanitizeString(name, 100);
    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Meter name cannot be blank' });
    }

    const updateRes = await pool.query(
      'UPDATE meters SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, meter_number, name',
      [cleanName, meterId, userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meter not found or unauthorized' });
    }

    return res.json({
      success: true,
      message: 'Meter name updated successfully',
      meter: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Error updating meter alias:', error);
    return res.status(500).json({ success: false, message: 'Internal server error updating meter name' });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings,
  changePassword,
  updateMeterPin,
  updateMeterAlias
};
