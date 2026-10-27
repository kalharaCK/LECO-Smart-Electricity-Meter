const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt } = require('node:crypto');
const { pool } = require('../config/db');
const smsService = require('../services/smsService');
const { validateNewPassword } = require('../services/passwordPolicy');

// Secure Cookie Configuration
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // Immune to JavaScript access (XSS mitigation)
    secure: isProd, // Transmit only over HTTPS in production
    sameSite: isProd ? 'strict' : 'lax', // Strict CSRF protection with local dev fallback
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  };
};

const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const passwordError = validateNewPassword(password);
    if (passwordError) return res.status(400).json({ success: false, error: passwordError });
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Disallow public signups from claiming 'staff' or 'admin' roles
    const requestedRole = (role || '').toLowerCase();
    const userRole = (requestedRole === 'staff' || requestedRole === 'admin') ? 'customer' : 'customer';

    const { full_name, address, mobile_number, nic } = req.body;

    const newUser = await pool.query(
      `INSERT INTO users (email, password, role, full_name, address, mobile_number, nic) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, role, full_name, address, mobile_number, nic, created_at`,
      [
        email.trim().toLowerCase(), 
        hashedPassword, 
        userRole, 
        full_name ? full_name.trim() : null, 
        address ? address.trim() : null, 
        mobile_number ? mobile_number.trim() : null, 
        nic ? nic.trim().toUpperCase() : null
      ]
    );

    // Initialize user settings with phone number
    if (mobile_number) {
      await pool.query(
        `INSERT INTO user_settings (user_id, phone_number) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET phone_number = EXCLUDED.phone_number`,
        [newUser.rows[0].id, mobile_number.trim()]
      );
    }

    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email, role: newUser.rows[0].role, full_name: newUser.rows[0].full_name },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Customer account created successfully',
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error('[Signup Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during signup' });
  }
};

/**
 * Step-by-step Registration: Step 2 -> Send SMS OTP to Mobile Number
 * POST /api/auth/register/send-otp
 */
const sendRegisterOtp = async (req, res) => {
  try {
    const rawMobile = req.body.mobile_number || req.body.mobile;
    const { email, nic } = req.body;
    if (!rawMobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is required to send verification code' });
    }
    const cleanMobile = rawMobile.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanNic = nic ? nic.trim().toUpperCase() : null;

    // Check if email already registered
    if (cleanEmail) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'An account with this email address is already registered.' });
      }
    }

    // Check if NIC already registered
    if (cleanNic) {
      const nicCheck = await pool.query('SELECT id FROM users WHERE UPPER(nic) = $1', [cleanNic]);
      if (nicCheck.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'An account with this NIC number is already registered.' });
      }
    }

    // Check if Mobile already registered
    const mobileCheck = await pool.query('SELECT id FROM users WHERE mobile_number = $1', [cleanMobile]);
    if (mobileCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this mobile number is already registered.' });
    }

    // Generate 6-digit random OTP
    const otpCode = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unverified registration OTPs for this mobile
    await pool.query(
      `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'registration'`,
      [cleanMobile]
    );

    // Save OTP
    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_code, expires_at)
       VALUES ('registration', $1, $2, $3)`,
      [cleanMobile, otpCode, expiresAt]
    );

    console.log(`[LECO SMS Gateway] Registration OTP for ${cleanMobile}: ${otpCode}`);

    // Dispatch SMS via Text.lk Gateway in customer preferred language
    const userLang = req.body.language || 'en';
    const smsRes = await smsService.sendEventSms({
      recipient: cleanMobile,
      eventType: 'otp',
      eventSubtype: 'registration',
      language: userLang,
      data: { otp: otpCode }
    });

    return res.json({
      success: true,
      message: `Verification code sent via SMS to ${cleanMobile}`,
      smsDelivered: smsRes.success
    });
  } catch (err) {
    console.error('[Send Register OTP Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error sending verification code' });
  }
};

/**
 * Step-by-step Registration: Complete with Name, Address, NIC, Mobile & OTP validation
 * POST /api/auth/register
 */
const registerWithProfile = async (req, res) => {
  try {
    const { full_name, address, nic, mobile_number, email, password, otp } = req.body;
    if (!email || !password || !mobile_number) {
      return res.status(400).json({ success: false, error: 'Email, mobile number, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile_number.trim();
    const cleanNic = nic ? nic.trim().toUpperCase() : null;
    const cleanName = full_name ? full_name.trim() : null;
    const cleanAddress = address ? address.trim() : null;

    // Check email uniqueness
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists' });
    }

    // Check NIC uniqueness if provided
    if (cleanNic) {
      const nicCheck = await pool.query('SELECT id FROM users WHERE UPPER(nic) = $1', [cleanNic]);
      if (nicCheck.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'An account with this NIC number already exists' });
      }
    }

    // Verify OTP for mobile
    if (otp) {
      const otpCheck = await pool.query(
        `SELECT id FROM verification_otps 
         WHERE identifier = $1 AND purpose = 'registration' AND otp_code = $2 AND expires_at > CURRENT_TIMESTAMP AND verified = FALSE
         ORDER BY id DESC LIMIT 1`,
        [cleanMobile, otp.trim()]
      );

      if (otpCheck.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid or expired SMS verification code. Please check and try again.' });
      }

      // Mark OTP as verified
      await pool.query(`UPDATE verification_otps SET verified = TRUE WHERE id = $1`, [otpCheck.rows[0].id]);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUserRes = await pool.query(
      `INSERT INTO users (email, password, role, full_name, address, mobile_number, nic) 
       VALUES ($1, $2, 'customer', $3, $4, $5, $6) 
       RETURNING id, email, role, full_name, address, mobile_number, nic, created_at`,
      [cleanEmail, hashedPassword, cleanName, cleanAddress, cleanMobile, cleanNic]
    );

    const newUser = newUserRes.rows[0];

    // Initialize user settings with phone number
    await pool.query(
      `INSERT INTO user_settings (user_id, phone_number) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET phone_number = EXCLUDED.phone_number`,
      [newUser.id, cleanMobile]
    );

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, full_name: newUser.full_name },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Customer account created and mobile verified successfully',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('[Registration Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during account registration' });
  }
};

/**
 * Forgot Password - Step 1: Validate NIC & Mobile Number, Send OTP
 * POST /api/auth/forgot-password/send-otp
 */
const sendForgotPasswordOtp = async (req, res) => {
  try {
    const nic = req.body.nic;
    const rawMobile = req.body.mobile_number || req.body.mobile;
    if (!nic || !rawMobile) {
      return res.status(400).json({ success: false, error: 'NIC number and registered Mobile number are required.' });
    }

    const cleanNic = nic.trim().toUpperCase();
    const cleanMobile = rawMobile.trim();

    // Find customer account matching NIC and Mobile number
    // Allows flexible phone matching (+9477... or 077...)
    const userRes = await pool.query(
      `SELECT id, email, full_name, mobile_number, nic, role FROM users 
       WHERE UPPER(TRIM(nic)) = $1 
         AND (
           mobile_number = $2 
           OR RIGHT(mobile_number, 9) = RIGHT($2, 9)
         )`,
      [cleanNic, cleanMobile]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No customer account found matching the provided NIC and Mobile Number. Please verify your details.'
      });
    }

    const user = userRes.rows[0];
    const otpCode = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unverified forgot password OTPs for this NIC
    await pool.query(
      `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'forgot_password'`,
      [cleanNic]
    );

    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_code, expires_at)
       VALUES ('forgot_password', $1, $2, $3)`,
      [cleanNic, otpCode, expiresAt]
    );

    console.log(`[LECO SMS Gateway] Password Reset OTP for NIC ${cleanNic} (${user.mobile_number}): ${otpCode}`);

    // Dispatch SMS via Text.lk Gateway
    const targetMobile = user.mobile_number || cleanMobile;
    const userLang = req.body.language || 'en';
    const smsRes = await smsService.sendEventSms({
      recipient: targetMobile,
      eventType: 'otp',
      eventSubtype: 'forgot_password',
      language: userLang,
      data: { otp: otpCode }
    });

    // Mask phone number for user privacy
    const maskedMobile = targetMobile.length >= 7 
      ? targetMobile.slice(0, 3) + '••••' + targetMobile.slice(-3)
      : '••••' + targetMobile.slice(-2);

    return res.json({
      success: true,
      message: `Verification code sent via SMS to registered mobile (${maskedMobile})`,
      maskedPhone: maskedMobile,
      smsDelivered: smsRes.success
    });
  } catch (err) {
    console.error('[Forgot Password Send OTP Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error processing password reset request' });
  }
};

/**
 * Forgot Password - Step 2: Validate OTP
 * POST /api/auth/forgot-password/verify-otp
 */
const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { nic, otp } = req.body;
    if (!nic || !otp) {
      return res.status(400).json({ success: false, error: 'NIC and verification code are required' });
    }

    const cleanNic = nic.trim().toUpperCase();
    const cleanOtp = otp.trim();

    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps 
       WHERE identifier = $1 AND purpose = 'forgot_password' AND otp_code = $2 AND expires_at > CURRENT_TIMESTAMP AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [cleanNic, cleanOtp]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    return res.json({ success: true, message: 'Verification code confirmed.' });
  } catch (err) {
    console.error('[Verify Forgot Password OTP Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error verifying code' });
  }
};

/**
 * Forgot Password - Step 3: Set New Password
 * POST /api/auth/forgot-password/reset
 */
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { nic, otp, newPassword } = req.body;
    if (!nic || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'NIC, verification code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    const cleanNic = nic.trim().toUpperCase();
    const cleanOtp = otp.trim();

    // Verify OTP
    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps 
       WHERE identifier = $1 AND purpose = 'forgot_password' AND otp_code = $2 AND expires_at > CURRENT_TIMESTAMP AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [cleanNic, cleanOtp]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    // Mark OTP as verified
    await pool.query(`UPDATE verification_otps SET verified = TRUE WHERE id = $1`, [otpCheck.rows[0].id]);

    // Update password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updateRes = await pool.query(
      `UPDATE users SET password = $1 WHERE UPPER(TRIM(nic)) = $2 RETURNING id, email, full_name`,
      [hashedPassword, cleanNic]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    console.log(`[Auth] Password reset successfully for NIC ${cleanNic} (${updateRes.rows[0].email})`);

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error resetting password' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    // Dispatch Login Attempt Alert via SMS if mobile number exists
    if (user.mobile_number) {
      const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      smsService.sendEventSms({
        recipient: user.mobile_number,
        eventType: 'login_attempt',
        language: req.body.language || 'en',
        data: { time: timeStr }
      }).catch(e => console.error('[Login SMS Alert Error]:', e.message));
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
};

/**
 * Dedicated Staff Login endpoint
 * Rejects any non-staff account with 403 Forbidden
 */
const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Staff email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid staff credentials' });
    }

    const user = userResult.rows[0];
    const role = (user.role || '').toLowerCase();
    if (role !== 'staff' && role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: This account does not possess LECO Staff privileges.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid staff credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Staff authentication successful',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[Staff Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during staff login' });
  }
};

/**
 * Dedicated Customer Login endpoint
 * Rejects staff accounts attempting to access customer space
 */
const customerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const role = (user.role || '').toLowerCase();
    if (role === 'staff' || role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Staff accounts must sign in via the LECO Staff Operations Portal.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    // Dispatch Login Attempt Alert via SMS if mobile number exists
    if (user.mobile_number) {
      const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      smsService.sendEventSms({
        recipient: user.mobile_number,
        eventType: 'login_attempt',
        language: req.body.language || 'en',
        data: { time: timeStr }
      }).catch(e => console.error('[Customer Login SMS Alert Error]:', e.message));
    }

    res.json({
      success: true,
      message: 'Customer login successful',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[Customer Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during customer login' });
  }
};

const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, role, full_name, address, mobile_number, nic, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user: userResult.rows[0] });
  } catch (err) {
    console.error('[getMe Error]:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = { 
  signup, 
  sendRegisterOtp,
  registerWithProfile,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  login, 
  staffLogin, 
  customerLogin, 
  logout, 
  getMe
};
