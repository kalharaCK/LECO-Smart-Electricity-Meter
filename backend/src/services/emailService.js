const nodemailer = require('nodemailer');

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  return require('../config/db').pool;
}

// Cache in-memory transporter to reuse connections across requests
let cachedTransporter = null;
let cachedConfigKey = null;

/**
 * Resolves active SMTP credentials:
 * 1. Checks `email_settings` table in PostgreSQL for staff-configured credentials.
 * 2. Falls back to `.env` variables (SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT).
 */
async function resolveSmtpCredentials() {
  try {
    const pool = getPool();
    if (pool) {
      const dbRes = await pool.query(
        `SELECT sender_email, app_password, smtp_host, smtp_port, smtp_secure, is_active 
         FROM email_settings 
         WHERE is_active = TRUE 
         ORDER BY id DESC 
         LIMIT 1`
      );

    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];
      const user = (row.sender_email || '').trim();
      const pass = (row.app_password || '').trim();
      if (user && pass) {
        return {
          user,
          pass,
          host: (row.smtp_host || 'smtp.gmail.com').trim(),
          port: parseInt(row.smtp_port, 10) || 465,
          secure: row.smtp_secure !== false,
          source: 'database',
          isConfigured: true
        };
      }
    }
  }
} catch (err) {
    // If table doesn't exist yet or query fails, fall back gracefully to environment
    console.warn('[EmailService] Notice: Database email_settings lookup skipped:', err.message);
  }

  // Fallback to environment variables
  const envUser = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
  const envPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
  const envHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const envPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const envSecure = process.env.SMTP_SECURE !== 'false';

  if (envUser && envPass) {
    return {
      user: envUser,
      pass: envPass,
      host: envHost,
      port: envPort,
      secure: envSecure,
      source: 'environment',
      isConfigured: true
    };
  }

  return {
    user: '',
    pass: '',
    host: envHost,
    port: envPort,
    secure: envSecure,
    source: 'none',
    isConfigured: false
  };
}

/**
 * Invalidate cached transporter when settings change
 */
function invalidateTransporterCache() {
  cachedTransporter = null;
  cachedConfigKey = null;
}

/**
 * Creates or retrieves cached Nodemailer transporter
 */
async function getTransporter() {
  const creds = await resolveSmtpCredentials();
  if (!creds.isConfigured) {
    return { transporter: null, creds };
  }

  const configKey = `${creds.user}:${creds.host}:${creds.port}:${creds.pass.slice(-4)}`;
  if (cachedTransporter && cachedConfigKey === configKey) {
    return { transporter: cachedTransporter, creds };
  }

  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure, // true for 465, false for other ports
    auth: {
      user: creds.user,
      pass: creds.pass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  cachedTransporter = transporter;
  cachedConfigKey = configKey;
  return { transporter, creds };
}

/**
 * Clean, Standard Formatted HTML Email Design (No Emojis)
 */
function buildOtpEmailHtml({ otp, purpose, recipientName, expiresMinutes = 10 }) {
  const purposeMap = {
    registration: {
      title: 'Account Registration Verification',
      badge: 'Account Registration',
      description: 'Thank you for registering with LECO Smart Prepayment Portal. Use the verification code below to verify your email and activate your account.'
    },
    forgot_password: {
      title: 'Password Reset Verification',
      badge: 'Password Reset',
      description: 'A password reset request was initiated for your LECO Smart Meter account. Use the verification code below to verify your identity and reset your password.'
    },
    verify_email: {
      title: 'Email Address Verification',
      badge: 'Email Verification',
      description: 'Please confirm your email address for official LECO digital bill delivery, monthly statements, and real-time balance alerts.'
    },
    default: {
      title: 'Security Verification Code',
      badge: 'Security Code',
      description: 'Your one-time verification code is provided below.'
    }
  };

  const info = purposeMap[purpose] || purposeMap.default;
  const greeting = recipientName ? `Dear ${recipientName},` : 'Valued Customer,';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0b2545 0%, #134074 100%);
      padding: 28px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header-logo-text {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #f59e0b;
      margin: 0;
      text-transform: uppercase;
    }
    .header-subtext {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 28px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 24px 0;
    }
    .otp-card {
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f2b48;
      margin: 4px 0;
      padding-left: 8px;
    }
    .otp-expiry {
      font-size: 12px;
      color: #dc2626;
      font-weight: 600;
      margin-top: 8px;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 24px;
    }
    .security-notice p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.5;
    }
    .help-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer strong {
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <p class="header-logo-text">LECO Smart Electricity</p>
        <p class="header-subtext">Lanka Electricity Company (Pvt) Ltd - AMI Prepayment Portal</p>
      </div>

      <div class="content">
        <span class="badge">${info.badge}</span>
        <div class="greeting">${greeting}</div>
        <p class="description">${info.description}</p>

        <div class="otp-card">
          <div class="otp-label">One-Time Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-expiry">Expires in ${expiresMinutes} minutes</div>
        </div>

        <div class="security-notice">
          <p><strong>Security Warning:</strong> Never share this code with anyone. LECO officers and customer support agents will never ask for your verification code.</p>
        </div>

        <div class="help-section">
          If you did not initiate this request, someone may have entered your email address by mistake. Please disregard this message or contact LECO 24/7 Helpline at <strong>1987</strong> immediately.
        </div>
      </div>

      <div class="footer">
        <strong>Lanka Electricity Company (Private) Limited</strong><br>
        24/7 Breakdown Hotline: 1987 &bull; Customer Care: 1910<br>
        Head Office: No. 411, Galle Road, Colombo 03, Sri Lanka<br>
        This is an automated system notification. Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Dispatches an OTP verification email to recipient
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.otp - 6-digit OTP code
 * @param {string} params.purpose - 'registration' | 'forgot_password' | 'verify_email'
 * @param {string} [params.recipientName] - Customer name
 * @param {number} [params.expiresMinutes=10] - Expiry window in minutes
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, simulated?: boolean }>}
 */
async function sendOtpEmail({ to, otp, purpose = 'registration', recipientName = '', expiresMinutes = 10 }) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Valid recipient email address is required' };
  }

  const cleanTo = to.trim().toLowerCase();
  const subjectMap = {
    registration: `LECO Smart Care - Registration Verification Code: ${otp}`,
    forgot_password: `LECO Smart Care - Password Reset Code: ${otp}`,
    verify_email: `LECO Smart Care - Email Verification Code: ${otp}`
  };
  const subject = subjectMap[purpose] || `LECO Verification Code: ${otp}`;
  const htmlContent = buildOtpEmailHtml({ otp, purpose, recipientName, expiresMinutes });
  const textContent = `LECO Smart Electricity Care\n\nYour ${purpose.replace('_', ' ')} verification code is: ${otp}\nValid for ${expiresMinutes} minutes.\n\nDo not share this code with anyone.\nIf not requested by you, call 1987.\n\nLanka Electricity Company (Pvt) Ltd`;

  const { transporter, creds } = await getTransporter();

  // If email gateway credentials are not yet configured
  if (!transporter || !creds.isConfigured) {
    console.warn(`[EmailService] SMTP not configured. OTP for ${cleanTo} logged safely: ${otp}`);
    try {
      await pool.query(
        `INSERT INTO email_logs (recipient, subject, purpose, status, error_message)
         VALUES ($1, $2, $3, 'pending_config', 'SMTP sender credentials not configured in Staff Portal or .env')`,
        [cleanTo, subject, purpose]
      );
    } catch (_) {}

    return {
      success: false,
      notConfigured: true,
      error: 'Email gateway credentials are not configured in Staff Portal or environment variables'
    };
  }

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[EmailService] OTP email delivered to ${cleanTo} (MessageId: ${info.messageId})`);

    // Audit log delivery in PostgreSQL
    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, message_id)
           VALUES ($1, $2, $3, 'sent', $4)`,
          [cleanTo, subject, purpose, info.messageId]
        );
      }
    } catch (logErr) {
      console.warn('[EmailService] Failed to write email log:', logErr.message);
    }

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EmailService] Error sending email to ${cleanTo}:`, err.message);

    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, error_message)
           VALUES ($1, $2, $3, 'failed', $4)`,
          [cleanTo, subject, purpose, err.message]
        );
      }
    } catch (_) {}

    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Sends a live test email initiated from the Staff Portal
 */
async function sendTestEmail(targetEmail) {
  if (!targetEmail || !targetEmail.includes('@')) {
    return { success: false, error: 'Valid test recipient email address is required' };
  }

  const cleanTo = targetEmail.trim().toLowerCase();
  const { transporter, creds } = await getTransporter();

  if (!transporter || !creds.isConfigured) {
    return {
      success: false,
      error: 'SMTP credentials are not yet configured. Please save your Sender Email and Gmail App Password first.'
    };
  }

  const subject = 'LECO Smart Care - System Diagnostic Test Email';
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
    .card { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .hdr { font-size: 18px; font-weight: bold; color: #0b2545; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px; }
    .row { font-size: 13px; margin: 8px 0; }
    .status { color: #16a34a; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">LECO Email Gateway - Connectivity Test</div>
    <p>This is a live diagnostic verification email dispatched from the LECO Staff Operations Console.</p>
    <div class="row"><strong>Status:</strong> <span class="status">SMTP Connected Successfully</span></div>
    <div class="row"><strong>Sender Account:</strong> ${creds.user}</div>
    <div class="row"><strong>SMTP Host:</strong> ${creds.host}:${creds.port}</div>
    <div class="row"><strong>Credential Source:</strong> ${creds.source}</div>
    <div class="row"><strong>Dispatched At:</strong> ${timestamp} (Asia/Colombo)</div>
    <p style="margin-top: 20px; font-size: 11px; color: #64748b;">Lanka Electricity Company (Pvt) Ltd - Operations Center</p>
  </div>
</body>
</html>
  `.trim();

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: `LECO Email Gateway Connectivity Test\n\nStatus: Connected Successfully\nSender: ${creds.user}\nHost: ${creds.host}:${creds.port}\nTimestamp: ${timestamp}`,
      html: htmlContent
    });

    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, message_id)
           VALUES ($1, $2, 'test_diagnostic', 'sent', $3)`,
          [cleanTo, subject, info.messageId]
        );
      }
    } catch (_) {}

    return {
      success: true,
      messageId: info.messageId,
      sender: creds.user,
      host: `${creds.host}:${creds.port}`
    };
  } catch (err) {
    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, error_message)
           VALUES ($1, $2, 'test_diagnostic', 'failed', $3)`,
          [cleanTo, subject, err.message]
        );
      }
    } catch (_) {}

    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Retrieves current email gateway status for Staff Portal
 */
async function getEmailConfigStatus() {
  const creds = await resolveSmtpCredentials();
  const maskedPass = creds.pass
    ? creds.pass.length > 4
      ? '•••• •••• •••• ' + creds.pass.slice(-4)
      : '••••••••••••'
    : '';

  return {
    isConfigured: creds.isConfigured,
    senderEmail: creds.user,
    maskedPassword: maskedPass,
    smtpHost: creds.host,
    smtpPort: creds.port,
    source: creds.source
  };
}

/**
 * Saves updated email settings to PostgreSQL `email_settings` table
 */
async function saveEmailConfig({ senderEmail, appPassword, smtpHost = 'smtp.gmail.com', smtpPort = 465 }) {
  if (!senderEmail || !senderEmail.includes('@')) {
    throw new Error('Valid sender email address is required');
  }

  const cleanEmail = senderEmail.trim().toLowerCase();
  const cleanHost = (smtpHost || 'smtp.gmail.com').trim();
  const portNum = parseInt(smtpPort, 10) || 465;

  // Clean Gmail app password (remove spaces if user copied "abcd efgh ijkl mnop")
  let cleanPass = appPassword ? appPassword.trim().replace(/\s+/g, '') : null;

  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not configured to save email settings');
  }

  // If password was omitted (e.g. updating host only), keep existing password
  if (!cleanPass) {
    const existing = await pool.query(
      `SELECT app_password FROM email_settings WHERE is_active = TRUE ORDER BY id DESC LIMIT 1`
    );
    if (existing.rows.length > 0) {
      cleanPass = existing.rows[0].app_password;
    } else if (process.env.SMTP_PASS) {
      cleanPass = process.env.SMTP_PASS.trim();
    } else {
      throw new Error('Gmail App Password is required');
    }
  }

  // Deactivate previous active configurations
  await pool.query(`UPDATE email_settings SET is_active = FALSE WHERE is_active = TRUE`);

  // Insert newly active configuration
  const insertRes = await pool.query(
    `INSERT INTO email_settings (sender_email, app_password, smtp_host, smtp_port, is_active, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
     RETURNING id, sender_email, smtp_host, smtp_port, is_active, updated_at`,
    [cleanEmail, cleanPass, cleanHost, portNum]
  );

  // Invalidate cached transporter so new credentials are immediately utilized
  invalidateTransporterCache();

  return {
    success: true,
    config: {
      id: insertRes.rows[0].id,
      senderEmail: insertRes.rows[0].sender_email,
      smtpHost: insertRes.rows[0].smtp_host,
      smtpPort: insertRes.rows[0].smtp_port,
      updatedAt: insertRes.rows[0].updated_at
    }
  };
}

/**
 * Returns recent email delivery audit logs
 */
async function getEmailLogs(limit = 50) {
  try {
    const pool = getPool();
    if (!pool) return [];
    const res = await pool.query(
      `SELECT id, recipient, subject, purpose, status, message_id, error_message, created_at
       FROM email_logs
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (err) {
    console.warn('[EmailService] getEmailLogs failed:', err.message);
    return [];
  }
}

module.exports = {
  resolveSmtpCredentials,
  getTransporter,
  buildOtpEmailHtml,
  sendOtpEmail,
  sendTestEmail,
  getEmailConfigStatus,
  saveEmailConfig,
  getEmailLogs,
  invalidateTransporterCache
};
