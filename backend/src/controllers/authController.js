const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');
const { validateNewPassword } = require('../services/passwordPolicy');
const { generateOtp, hashOtp } = require('../services/otpService');

/**
 * Masks email address for user privacy (e.g. sahan@gmail.com -> sa***n@gmail.com)
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

/**
 * Safe SMS dispatch with a timeout cap (default 4000ms) to ensure external SMS gateway latency
 * or failures NEVER delay Email OTP delivery, block the user, or exceed request timeouts.
 */
async function dispatchSmsSafe(smsPromiseFactory, timeoutMs = 4000) {
  let timer;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({
          success: false,
          timedOut: true,
          errorMessage: 'SMS dispatch gateway timed out'
        });
      }, timeoutMs);
    });

    const executionPromise = (typeof smsPromiseFactory === 'function' ? smsPromiseFactory() : smsPromiseFactory)
      .then((res) => {
        if (timer) clearTimeout(timer);
        return res;
      })
      .catch((err) => {
        if (timer) clearTimeout(timer);
        console.error('[SMS Dispatch Error]:', err.message);
        return { success: false, errorMessage: err.message };
      });

    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (err) {
    if (timer) clearTimeout(timer);
    console.error('[SMS Dispatch Exception]:', err.message);
    return { success: false, errorMessage: err.message };
  }
}

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
      process.env.JWT_SECRET,
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
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unverified registration OTPs for this mobile and email
    await pool.query(
      `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'registration'`,
      [cleanMobile]
    );
    if (cleanEmail) {
      await pool.query(
        `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'registration'`,
        [cleanEmail]
      );
    }

    // Save OTP for mobile
    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
       VALUES ('registration', $1, $2, $3)`,
      [cleanMobile, hashOtp(otpCode), expiresAt]
    );

    // Save OTP for email
    if (cleanEmail) {
      await pool.query(
        `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
         VALUES ('registration', $1, $2, $3)`,
        [cleanEmail, hashOtp(otpCode), expiresAt]
      );
    }

    // Dispatch SMS and Email OTP in parallel with safe timeout on SMS
    const userLang = req.body.language || 'en';
    const smsTask = dispatchSmsSafe(() => smsService.sendEventSms({
      recipient: cleanMobile,
      eventType: 'otp',
      eventSubtype: 'registration',
      language: userLang,
      data: { otp: otpCode }
    }), 4000);

    const emailTask = cleanEmail
      ? emailService.sendOtpEmail({
          to: cleanEmail,
          otp: otpCode,
          purpose: 'registration',
          recipientName: req.body.full_name || '',
          expiresMinutes: 10
        }).catch((err) => {
          console.error('[Email Dispatch Error]:', err.message);
          return { success: false, errorMessage: err.message };
        })
      : Promise.resolve({ success: false, notRequested: true });

    const [smsSettled, emailSettled] = await Promise.allSettled([smsTask, emailTask]);

    const smsRes = smsSettled.status === 'fulfilled' ? smsSettled.value : { success: false, errorMessage: smsSettled.reason?.message };
    const emailRes = emailSettled.status === 'fulfilled' ? emailSettled.value : { success: false, errorMessage: emailSettled.reason?.message };

    const isSmsDelivered = Boolean(smsRes && smsRes.success);
    const isEmailDelivered = Boolean(emailRes && emailRes.success);
    const fallbackToEmail = !isSmsDelivered && Boolean(cleanEmail);

    let deliveryNotice;
    if (!isSmsDelivered && cleanEmail) {
      deliveryNotice = `SMS delivery delayed or unavailable. Verification code sent directly to your email (${cleanEmail}).`;
    } else if (cleanEmail) {
      deliveryNotice = `Verification code sent to your mobile (${cleanMobile}) and email (${cleanEmail})`;
    } else {
      deliveryNotice = `Verification code sent via SMS to ${cleanMobile}`;
    }

    if (res.headersSent) return;
    return res.json({
      success: true,
      message: deliveryNotice,
      smsDelivered: isSmsDelivered,
      emailDelivered: isEmailDelivered,
      fallbackToEmail,
      email: cleanEmail
    });
  } catch (err) {
    console.error('[Send Register OTP Error]:', err);
    if (res.headersSent) return;
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
    if (!email || !password || !mobile_number || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Email, mobile number, password, and a six-digit verification code are required' });
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

    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps
       WHERE identifier IN ($1, $2) AND purpose = 'registration' AND (otp_hash = $3 OR otp_code = $4) AND expires_at > CURRENT_TIMESTAMP AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [cleanMobile, cleanEmail, hashOtp(otp), otp]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code. Please check and try again.' });
    }

    const consumedOtp = await pool.query(
      `UPDATE verification_otps
       SET verified = TRUE, otp_hash = NULL, otp_code = NULL
       WHERE identifier IN ($1, $2) AND purpose = 'registration' AND verified = FALSE AND expires_at > CURRENT_TIMESTAMP
       RETURNING id`,
      [cleanMobile, cleanEmail]
    );
    if (consumedOtp.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code. Please request a new code.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUserRes = await pool.query(
      `INSERT INTO users (email, password, role, full_name, address, mobile_number, nic, email_verified) 
       VALUES ($1, $2, 'customer', $3, $4, $5, $6, TRUE) 
       RETURNING id, email, role, full_name, address, mobile_number, nic, email_verified, created_at`,
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
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Customer account created and mobile verified successfully',
      user: newUser
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
    const rawEmail = req.body.email || req.body.loginEmail;
    const rawNic = req.body.nic;
    const rawMobile = req.body.mobile_number || req.body.mobile;

    if (!rawEmail && !rawNic) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registered Email address or NIC number is required to reset your password.' 
      });
    }

    const cleanEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
    const cleanNic = rawNic ? rawNic.trim().toUpperCase() : null;
    const cleanMobile = rawMobile ? rawMobile.trim() : null;

    let targetUser = null;

    // 1. Primary lookup: by Email
    if (cleanEmail) {
      const emailUserRes = await pool.query(
        `SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE email = $1`,
        [cleanEmail]
      );
      if (emailUserRes.rows.length > 0) {
        targetUser = emailUserRes.rows[0];

        // If NIC is also supplied and account already has an NIC, verify it matches
        if (cleanNic && targetUser.nic && targetUser.nic.trim().toUpperCase() !== cleanNic) {
          return res.status(400).json({
            success: false,
            error: `The provided NIC (${cleanNic}) does not match the registered account details for ${cleanEmail}.`
          });
        }
      }
    }

    // 2. Secondary lookup: by NIC & Mobile (if not found by email or if email not supplied)
    if (!targetUser && cleanNic) {
      let nicQuery = `SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE UPPER(TRIM(nic)) = $1`;
      const nicParams = [cleanNic];

      if (cleanMobile) {
        nicQuery += ` AND (mobile_number = $2 OR RIGHT(mobile_number, 9) = RIGHT($2, 9))`;
        nicParams.push(cleanMobile);
      }

      const nicUserRes = await pool.query(nicQuery, nicParams);
      if (nicUserRes.rows.length > 0) {
        targetUser = nicUserRes.rows[0];
      }
    }

    if (!targetUser) {
      const lookupTarget = cleanEmail || cleanNic;
      return res.status(404).json({
        success: false,
        error: `No customer account found for "${lookupTarget}". Please verify your email or sign up.`
      });
    }

    const destinationEmail = targetUser.email ? targetUser.email.trim().toLowerCase() : cleanEmail;
    const destinationMobile = targetUser.mobile_number || cleanMobile;
    const destinationNic = targetUser.nic ? targetUser.nic.trim().toUpperCase() : cleanNic;

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unverified forgot password OTPs for this user's identifiers
    const identifiersToClean = [destinationEmail, destinationNic, destinationMobile].filter(Boolean);
    if (identifiersToClean.length > 0) {
      await pool.query(
        `DELETE FROM verification_otps WHERE identifier = ANY($1) AND purpose = 'forgot_password'`,
        [identifiersToClean]
      );
    }

    // Save OTP for Email identifier
    if (destinationEmail) {
      await pool.query(
        `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
         VALUES ('forgot_password', $1, $2, $3)`,
        [destinationEmail, hashOtp(otpCode), expiresAt]
      );
    }

    // Save OTP for NIC identifier
    if (destinationNic) {
      await pool.query(
        `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
         VALUES ('forgot_password', $1, $2, $3)`,
        [destinationNic, hashOtp(otpCode), expiresAt]
      );
    }

    // Dispatch Email OTP to the user's registered/provided email address
    // and SMS OTP in parallel with safe timeout on SMS
    const userLang = req.body.language || 'en';

    const emailTask = destinationEmail
      ? emailService.sendOtpEmail({
          to: destinationEmail,
          otp: otpCode,
          purpose: 'forgot_password',
          recipientName: targetUser.full_name || 'Valued Customer',
          expiresMinutes: 10
        }).catch((err) => {
          console.error('[Forgot Password Email Dispatch Error]:', err.message);
          return { success: false, errorMessage: err.message };
        })
      : Promise.resolve({ success: false, notRequested: true });

    const smsTask = destinationMobile
      ? dispatchSmsSafe(() => smsService.sendEventSms({
          recipient: destinationMobile,
          eventType: 'otp',
          eventSubtype: 'forgot_password',
          language: userLang,
          data: { otp: otpCode }
        }), 4000)
      : Promise.resolve({ success: false, notRequested: true });

    const [emailSettled, smsSettled] = await Promise.allSettled([emailTask, smsTask]);

    const emailRes = emailSettled.status === 'fulfilled' ? emailSettled.value : { success: false, errorMessage: emailSettled.reason?.message };
    const smsRes = smsSettled.status === 'fulfilled' ? smsSettled.value : { success: false, errorMessage: smsSettled.reason?.message };

    const isEmailDelivered = Boolean(emailRes && emailRes.success);
    const isSmsDelivered = Boolean(smsRes && smsRes.success);
    const fallbackToEmail = !isSmsDelivered && Boolean(destinationEmail);

    // Mask destinations for UI feedback
    const maskedEmail = destinationEmail ? maskEmail(destinationEmail) : null;
    const maskedMobile = destinationMobile 
      ? (destinationMobile.length >= 7 
          ? destinationMobile.slice(0, 3) + '••••' + destinationMobile.slice(-3)
          : '••••' + destinationMobile.slice(-2))
      : null;

    let deliveryMsg;
    if (!isSmsDelivered && destinationEmail) {
      deliveryMsg = `SMS delivery delayed or unavailable. Verification code sent directly to your registered email (${maskedEmail}).`;
    } else if (destinationMobile && isEmailDelivered) {
      deliveryMsg = `Verification code sent to your email (${maskedEmail}) and mobile (${maskedMobile})`;
    } else {
      deliveryMsg = `Verification code sent to your registered email (${maskedEmail})`;
    }

    return res.json({
      success: true,
      message: deliveryMsg,
      email: destinationEmail,
      maskedEmail,
      maskedPhone: maskedMobile,
      emailDelivered: isEmailDelivered,
      smsDelivered: isSmsDelivered,
      fallbackToEmail
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
    const rawEmail = req.body.email || req.body.loginEmail;
    const rawNic = req.body.nic;
    const rawOtp = req.body.otp;

    if (!rawOtp || (!rawEmail && !rawNic)) {
      return res.status(400).json({ success: false, error: 'Email or NIC and 6-digit verification code are required' });
    }

    const cleanEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
    const cleanNic = rawNic ? rawNic.trim().toUpperCase() : null;
    const cleanOtp = rawOtp.trim();

    const searchIdentifiers = [cleanEmail, cleanNic].filter(Boolean);

    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps
       WHERE identifier = ANY($1) 
         AND purpose = 'forgot_password' 
         AND (otp_hash = $2 OR otp_code = $3) 
         AND expires_at > CURRENT_TIMESTAMP 
         AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [searchIdentifiers, hashOtp(cleanOtp), cleanOtp]
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
    const rawEmail = req.body.email || req.body.loginEmail;
    const rawNic = req.body.nic;
    const rawOtp = req.body.otp;
    const newPassword = req.body.newPassword || req.body.password;

    if (!rawOtp || !newPassword || (!rawEmail && !rawNic)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email or NIC, verification code, and new password are required' 
      });
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, error: passwordError });

    const cleanEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
    const cleanNic = rawNic ? rawNic.trim().toUpperCase() : null;
    const cleanOtp = rawOtp.trim();

    // 1. Locate the exact user account
    let targetUser = null;
    if (cleanEmail) {
      const emailUserRes = await pool.query(
        `SELECT id, email, full_name, mobile_number, nic FROM users WHERE email = $1`,
        [cleanEmail]
      );
      if (emailUserRes.rows.length > 0) targetUser = emailUserRes.rows[0];
    }

    if (!targetUser && cleanNic) {
      const nicUserRes = await pool.query(
        `SELECT id, email, full_name, mobile_number, nic FROM users WHERE UPPER(TRIM(nic)) = $1`,
        [cleanNic]
      );
      if (nicUserRes.rows.length > 0) targetUser = nicUserRes.rows[0];
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // 2. Verify OTP against all associated identifiers
    const identifiersToVerify = [
      cleanEmail,
      cleanNic,
      targetUser.email ? targetUser.email.trim().toLowerCase() : null,
      targetUser.nic ? targetUser.nic.trim().toUpperCase() : null
    ].filter(Boolean);

    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps
       WHERE identifier = ANY($1) 
         AND purpose = 'forgot_password' 
         AND (otp_hash = $2 OR otp_code = $3) 
         AND expires_at > CURRENT_TIMESTAMP 
         AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [[...new Set(identifiersToVerify)], hashOtp(cleanOtp), cleanOtp]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    // 3. Mark OTP as consumed
    await pool.query(
      `UPDATE verification_otps
       SET verified = TRUE, otp_hash = NULL, otp_code = NULL
       WHERE identifier = ANY($1) 
         AND purpose = 'forgot_password' 
         AND verified = FALSE 
         AND expires_at > CURRENT_TIMESTAMP`,
      [[...new Set(identifiersToVerify)]]
    );

    // 4. Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 5. Update user password by User ID (ensures 100% precision)
    let updateSql = `UPDATE users SET password = $1`;
    const updateParams = [hashedPassword, targetUser.id];

    if (cleanNic && !targetUser.nic) {
      updateSql += `, nic = $3 WHERE id = $2 RETURNING id, email, full_name, nic`;
      updateParams.push(cleanNic);
    } else {
      updateSql += ` WHERE id = $2 RETURNING id, email, full_name, nic`;
    }

    await pool.query(updateSql, updateParams);

    console.log(`[Auth] Password reset successfully for customer ${targetUser.email} (ID: ${targetUser.id})`);

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.',
      email: targetUser.email
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

    // Dispatch Login Attempt Alert via Email if email exists (Security notice only - no OTP/reset code)
    if (user.email) {
      const timeStr = new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const clientIp = (req.headers && req.headers['x-forwarded-for'])?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '127.0.0.1';
      emailService.sendLoginAttemptAlertEmail({
        to: user.email,
        recipientName: user.full_name || '',
        loginTime: timeStr,
        ipAddress: clientIp,
        userAgent: (req.headers && req.headers['user-agent']) || 'Web Browser'
      }).catch(e => console.error('[Login Email Alert Error]:', e.message));
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

    // Dispatch Login Attempt Alert via Email if email exists (Security notice only - no OTP/reset code)
    if (user.email) {
      const timeStr = new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const clientIp = (req.headers && req.headers['x-forwarded-for'])?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '127.0.0.1';
      emailService.sendLoginAttemptAlertEmail({
        to: user.email,
        recipientName: user.full_name || '',
        loginTime: timeStr,
        ipAddress: clientIp,
        userAgent: (req.headers && req.headers['user-agent']) || 'Staff Operations Portal'
      }).catch(e => console.error('[Staff Login Email Alert Error]:', e.message));
    }

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

    // Dispatch Login Attempt Alert via Email if email exists (Security notice only - no OTP/reset code)
    if (user.email) {
      const timeStr = new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const clientIp = (req.headers && req.headers['x-forwarded-for'])?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '127.0.0.1';
      emailService.sendLoginAttemptAlertEmail({
        to: user.email,
        recipientName: user.full_name || '',
        loginTime: timeStr,
        ipAddress: clientIp,
        userAgent: (req.headers && req.headers['user-agent']) || 'Customer Portal'
      }).catch(e => console.error('[Customer Login Email Alert Error]:', e.message));
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
    const userResult = await pool.query('SELECT id, email, role, full_name, address, mobile_number, nic, email_verified, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user: userResult.rows[0] });
  } catch (err) {
    console.error('[getMe Error]:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Email Verification: Send OTP to verify email address
 * POST /api/auth/verify-email/send-otp
 */
const sendEmailVerificationOtp = async (req, res) => {
  try {
    const email = req.body.email || req.user?.email;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Generate 6-digit random OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Look up if user has a mobile number registered
    const userLookup = await pool.query(
      `SELECT mobile_number, full_name FROM users WHERE email = $1 LIMIT 1`,
      [cleanEmail]
    );
    const user = userLookup.rows[0];

    // Invalidate previous unverified verify_email OTPs for this email and mobile
    await pool.query(
      `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'verify_email'`,
      [cleanEmail]
    );
    if (user?.mobile_number) {
      await pool.query(
        `DELETE FROM verification_otps WHERE identifier = $1 AND purpose = 'verify_email'`,
        [user.mobile_number.trim()]
      );
    }

    // Save OTP for email
    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
       VALUES ('verify_email', $1, $2, $3)`,
      [cleanEmail, hashOtp(otpCode), expiresAt]
    );

    // Save OTP for mobile if available
    if (user?.mobile_number) {
      await pool.query(
        `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
         VALUES ('verify_email', $1, $2, $3)`,
        [user.mobile_number.trim(), hashOtp(otpCode), expiresAt]
      );
    }

    // Dispatch Email and SMS in parallel with safe SMS timeout
    const emailTask = emailService.sendOtpEmail({
      to: cleanEmail,
      otp: otpCode,
      purpose: 'verify_email',
      recipientName: user?.full_name || req.user?.full_name || '',
      expiresMinutes: 10
    }).catch((err) => {
      console.error('[Verify Email Dispatch Error]:', err.message);
      return { success: false, errorMessage: err.message };
    });

    const smsTask = user?.mobile_number
      ? dispatchSmsSafe(() => smsService.sendEventSms({
          recipient: user.mobile_number,
          eventType: 'otp',
          eventSubtype: 'registration',
          language: req.body.language || 'en',
          data: { otp: otpCode }
        }), 4000)
      : Promise.resolve({ success: false, notRequested: true });

    const [emailSettled, smsSettled] = await Promise.allSettled([emailTask, smsTask]);
    const emailRes = emailSettled.status === 'fulfilled' ? emailSettled.value : { success: false, errorMessage: emailSettled.reason?.message };
    const smsRes = smsSettled.status === 'fulfilled' ? smsSettled.value : { success: false, errorMessage: smsSettled.reason?.message };

    const isEmailDelivered = Boolean(emailRes && emailRes.success);
    const isSmsDelivered = Boolean(smsRes && smsRes.success);
    const fallbackToEmail = !isSmsDelivered;

    let deliveryMsg;
    if (!isSmsDelivered && user?.mobile_number) {
      deliveryMsg = `SMS delivery delayed or unavailable. Verification code dispatched to your email (${cleanEmail}).`;
    } else if (user?.mobile_number && isEmailDelivered) {
      deliveryMsg = `Verification code dispatched to email (${cleanEmail}) and SMS (${user.mobile_number})`;
    } else {
      deliveryMsg = `Verification code dispatched to email (${cleanEmail})`;
    }

    return res.json({
      success: true,
      message: deliveryMsg,
      emailDelivered: isEmailDelivered,
      smsDelivered: isSmsDelivered,
      fallbackToEmail
    });
  } catch (err) {
    console.error('[Send Email Verification OTP Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error sending email verification code' });
  }
};

/**
 * Email Verification: Confirm OTP and mark email as verified
 * POST /api/auth/verify-email/confirm
 */
const confirmEmailVerification = async (req, res) => {
  try {
    const email = req.body.email || req.user?.email;
    const { otp } = req.body;
    if (!email || !otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({ success: false, error: 'Valid email and a 6-digit verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const userLookup = await pool.query(
      `SELECT mobile_number FROM users WHERE email = $1 LIMIT 1`,
      [cleanEmail]
    );
    const userMobile = userLookup.rows[0]?.mobile_number ? userLookup.rows[0].mobile_number.trim() : cleanEmail;

    const otpCheck = await pool.query(
      `SELECT id FROM verification_otps
       WHERE identifier IN ($1, $2) AND purpose = 'verify_email' 
         AND (otp_hash = $3 OR otp_code = $4) 
         AND expires_at > CURRENT_TIMESTAMP 
         AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [cleanEmail, userMobile, hashOtp(cleanOtp), cleanOtp]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired email verification code. Please request a new code.' });
    }

    await pool.query(
      `UPDATE verification_otps
       SET verified = TRUE, otp_hash = NULL, otp_code = NULL
       WHERE identifier IN ($1, $2) AND purpose = 'verify_email'`,
      [cleanEmail, userMobile]
    );

    // Update user record
    await pool.query(
      `UPDATE users SET email_verified = TRUE WHERE email = $1`,
      [cleanEmail]
    );

    return res.json({
      success: true,
      message: 'Email address verified successfully.'
    });
  } catch (err) {
    console.error('[Confirm Email Verification Error]:', err);
    return res.status(500).json({ success: false, error: 'Server error confirming email verification' });
  }
};

module.exports = { 
  signup, 
  sendRegisterOtp,
  registerWithProfile,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  sendEmailVerificationOtp,
  confirmEmailVerification,
  login, 
  staffLogin, 
  customerLogin, 
  logout, 
  getMe
};

