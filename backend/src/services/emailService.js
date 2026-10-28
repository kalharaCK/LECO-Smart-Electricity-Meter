const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const LOGO_CID = 'lecologo@leco.lk';
const LOGO_PATH = path.join(__dirname, '../assets/leco-logo.png');

function getLogoAttachment() {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      return {
        filename: 'leco-logo.png',
        path: LOGO_PATH,
        cid: LOGO_CID
      };
    }
  } catch (err) {
    console.warn('[EmailService] Logo file lookup notice:', err.message);
  }
  return null;
}

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
        const pass = (row.app_password || '').trim().replace(/\s+/g, '');
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
  const envPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');
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
 * Professional, Executive Themed HTML Email Design with Logo (Strict Zero Emojis)
 */
function buildOtpEmailHtml({ otp, purpose, recipientName, expiresMinutes = 10, logoSrc = `cid:${LOGO_CID}` }) {
  const purposeMap = {
    registration: {
      title: 'Account Registration Verification',
      badge: 'Account Registration',
      description: 'Thank you for registering with the LECO Smart Prepayment Portal. Use the verification code below to verify your email address and activate your smart meter account.'
    },
    forgot_password: {
      title: 'Password Reset Verification',
      badge: 'Password Reset',
      description: 'A password reset request was initiated for your LECO Smart Meter account. Use the verification code below to verify your identity and reset your account password.'
    },
    verify_email: {
      title: 'Email Address Verification',
      badge: 'Email Verification',
      description: 'Please confirm your email address for official LECO digital bill delivery, monthly consumption statements, and real-time smart meter balance alerts.'
    },
    default: {
      title: 'Security Verification Code',
      badge: 'Security Code',
      description: 'Your one-time security verification code is provided below to verify your request.'
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
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${info.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 36px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .gold-accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #eab308 0%, #facc15 50%, #eab308 100%);
      width: 100%;
    }
    .header {
      background-color: #ffffff;
      padding: 32px 28px 20px 28px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-img {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      display: inline-block;
      object-fit: contain;
      vertical-align: middle;
    }
    .header-logo-text {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 12px 0 0 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .header-subtext {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin: 4px 0 0 0;
    }
    .content {
      padding: 32px 28px;
      background-color: #ffffff;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 24px 0;
    }
    .otp-card {
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
    }
    .otp-code {
      font-family: 'SF Pro Mono', Menlo, Consolas, Monaco, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f172a;
      background-color: #ffffff;
      padding: 12px 28px;
      border: 2px solid #eab308;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      margin: 2px 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #b91c1c;
      font-weight: 600;
      margin-top: 12px;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }
    .security-notice p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.55;
    }
    .help-section {
      border-top: 1px solid #f1f5f9;
      padding-top: 18px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 28px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .footer-hotline {
      color: #475569;
      margin-bottom: 8px;
    }
    .footer-hotline strong {
      color: #0f172a;
    }
    .footer-legal {
      color: #94a3b8;
      font-size: 10px;
      margin-top: 6px;
    }
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 12px 8px !important;
      }
      .container {
        width: 100% !important;
        border-radius: 8px !important;
      }
      .header {
        padding: 24px 16px 16px 16px !important;
      }
      .content {
        padding: 24px 16px !important;
      }
      .otp-card {
        padding: 20px 12px !important;
      }
      .otp-code {
        font-size: 28px !important;
        letter-spacing: 6px !important;
        padding: 10px 16px !important;
      }
      .footer {
        padding: 20px 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <div class="container">
            <div class="gold-accent-bar"></div>
            <div class="header">
              <div style="text-align: center;">
                <img src="${logoSrc}" alt="LECO Logo" class="logo-img" width="70" height="70" />
              </div>
              <p class="header-logo-text">LECO Smart Electricity</p>
              <p class="header-subtext">Lanka Electricity Company (Pvt) Ltd &bull; Customer Self Care</p>
            </div>

            <div class="content">
              <span class="badge">${info.badge}</span>
              <div class="greeting">${greeting}</div>
              <p class="description">${info.description}</p>

              <div class="otp-card">
                <div class="otp-label">One-Time Verification Code</div>
                <div class="otp-code">${otp}</div>
                <div class="otp-expiry">Expires in ${expiresMinutes} minutes &bull; Single-use security code</div>
              </div>

              <div class="security-notice">
                <p><strong style="color: #78350f;">Security Notice:</strong> Never share this code with anyone. LECO staff or customer support will never ask for your verification code or account password.</p>
              </div>

              <div class="help-section">
                If you did not initiate this request, someone may have entered your email address by mistake. Please disregard this message or contact LECO 24/7 Helpline at <strong style="color: #0f172a;">1987</strong>.
              </div>
            </div>

            <div class="footer">
              <div class="footer-title">Lanka Electricity Company (Private) Limited</div>
              <div class="footer-hotline">
                24/7 Breakdown Hotline: <strong>1987</strong> &bull; Customer Care: <strong>1910</strong> &bull; Portal: <a href="https://leco.lk" style="color: #0284c7; text-decoration: none; font-weight: 600;">www.leco.lk</a>
              </div>
              <div class="footer-legal">
                Head Office: No. 411, Galle Road, Colombo 03, Sri Lanka<br>
                This is an automated system notification from LECO AMI Smart Infrastructure. Please do not reply directly to this email.
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Diagnostic Test Email Template (Staff Portal)
 */
function buildTestDiagnosticEmailHtml({ creds, timestamp, logoSrc = `cid:${LOGO_CID}` }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LECO Email Gateway - Connectivity Test</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 32px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .gold-accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #eab308 0%, #facc15 50%, #eab308 100%);
      width: 100%;
    }
    .header {
      background-color: #ffffff;
      padding: 32px 28px 20px 28px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-img {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      display: inline-block;
      object-fit: contain;
      vertical-align: middle;
    }
    .header-logo-text {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 12px 0 0 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .header-subtext {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin: 4px 0 0 0;
    }
    .content {
      padding: 32px 28px;
      background-color: #ffffff;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #f0fdf4;
      color: #15803d;
      border: 1px solid #bbf7d0;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 20px 0;
    }
    .table-card {
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 28px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .footer-sub {
      color: #475569;
      margin-bottom: 8px;
    }
    .footer-legal {
      color: #94a3b8;
      font-size: 10px;
      margin-top: 6px;
    }
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 12px 8px !important;
      }
      .container {
        width: 100% !important;
        border-radius: 8px !important;
      }
      .header {
        padding: 24px 16px 16px 16px !important;
      }
      .content {
        padding: 24px 16px !important;
      }
      .table-card {
        padding: 14px 12px !important;
      }
      .footer {
        padding: 20px 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <div class="container">
            <div class="gold-accent-bar"></div>
            <div class="header">
              <div style="text-align: center;">
                <img src="${logoSrc}" alt="LECO Logo" class="logo-img" width="70" height="70" />
              </div>
              <p class="header-logo-text">LECO Smart Electricity</p>
              <p class="header-subtext">Lanka Electricity Company (Pvt) Ltd &bull; Operations Console</p>
            </div>

            <div class="content">
              <span class="badge">SMTP Connectivity Verified</span>
              <div class="section-title">System Diagnostic Verification Email</div>
              <p class="description">
                This live diagnostic email was successfully dispatched from the LECO Staff Operations Management Console. Your SMTP email gateway credentials and secure transmission channels are functioning as expected.
              </p>

              <div class="table-card">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Diagnostic Status</td>
                    <td align="right" style="padding: 8px 0;"><span style="color: #15803d; background: #dcfce7; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Connected</span></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">Sender Account</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">${creds.user}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">SMTP Host</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">${creds.host}:${creds.port}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">Credential Source</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0; text-transform: capitalize;">${creds.source}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">Dispatched At</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">${timestamp}</td>
                  </tr>
                </table>
              </div>
            </div>

            <div class="footer">
              <div class="footer-title">Lanka Electricity Company (Private) Limited</div>
              <div class="footer-sub">Staff Operations &bull; Central Telemetry Management</div>
              <div class="footer-legal">Automated internal diagnostics. Confidential.</div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Customer Welcome Email Template with Official LECO Logo
 */
function buildCustomerWelcomeEmailHtml({ fullName, email, nic, meter, logoSrc = `cid:${LOGO_CID}` }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to LECO Smart Electricity Prepayment</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 32px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .gold-accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #eab308 0%, #facc15 50%, #eab308 100%);
      width: 100%;
    }
    .header {
      background-color: #ffffff;
      padding: 32px 28px 20px 28px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-img {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      display: inline-block;
      object-fit: contain;
      vertical-align: middle;
    }
    .header-logo-text {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 12px 0 0 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .header-subtext {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin: 4px 0 0 0;
    }
    .content {
      padding: 32px 28px;
      background-color: #ffffff;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 24px 0;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 28px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .footer-hotline {
      color: #475569;
      margin-bottom: 8px;
    }
    .footer-hotline strong {
      color: #0f172a;
    }
    .footer-legal {
      color: #94a3b8;
      font-size: 10px;
      margin-top: 6px;
    }
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 12px 8px !important;
      }
      .container {
        width: 100% !important;
        border-radius: 8px !important;
      }
      .header {
        padding: 24px 16px 16px 16px !important;
      }
      .content {
        padding: 24px 16px !important;
      }
      .info-card {
        padding: 14px 12px !important;
      }
      .footer {
        padding: 20px 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <div class="container">
            <div class="gold-accent-bar"></div>
            <div class="header">
              <div style="text-align: center;">
                <img src="${logoSrc}" alt="LECO Logo" class="logo-img" width="70" height="70" />
              </div>
              <p class="header-logo-text">LECO Smart Electricity</p>
              <p class="header-subtext">Lanka Electricity Company (Pvt) Ltd &bull; Customer Self Care</p>
            </div>

            <div class="content">
              <span class="badge">Customer Account Activated</span>
              <div class="greeting">Dear ${fullName || 'Customer'},</div>
              <p class="description">
                Welcome to Lanka Electricity Company Smart Prepayment. Your customer profile has been registered in the LECO AMI Smart Metering Platform. You can now access your dashboard to view real-time energy usage, manage balances, and receive instant tariff alerts.
              </p>

              <div class="info-card">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Account Email</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700;">${email}</td>
                  </tr>
                  ${nic ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">National Identity Card</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">${nic}</td>
                  </tr>` : ''}
                  ${meter ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px solid #e2e8f0;">Assigned Smart Meter</td>
                    <td align="right" style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0;">${meter.meter_number} (${meter.account_number})</td>
                  </tr>` : ''}
                </table>
              </div>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 12px; color: #64748b; line-height: 1.6;">
                For security, please sign in to the LECO Customer Portal and customize your password and notification preferences. If you have any questions, our 24/7 team is available at <strong style="color: #0f172a;">1987</strong>.
              </div>
            </div>

            <div class="footer">
              <div class="footer-title">Lanka Electricity Company (Private) Limited</div>
              <div class="footer-hotline">
                24/7 Breakdown Hotline: <strong>1987</strong> &bull; Customer Care: <strong>1910</strong> &bull; Portal: <a href="https://leco.lk" style="color: #0284c7; text-decoration: none; font-weight: 600;">www.leco.lk</a>
              </div>
              <div class="footer-legal">
                Head Office: No. 411, Galle Road, Colombo 03, Sri Lanka<br>
                This is an automated system notification from LECO AMI Smart Infrastructure. Please do not reply directly to this email.
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds Security Login Alert Email Template (Zero emojis, official LECO branding)
 */
function buildLoginAttemptEmailHtml({
  recipientName = '',
  accountEmail = '',
  loginTime = '',
  ipAddress = '127.0.0.1',
  userAgent = 'Web Browser',
  logoSrc = `cid:${LOGO_CID}`
}) {
  const greeting = recipientName ? `Dear ${recipientName},` : 'Valued Customer,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LECO Security Alert: Successful Account Login</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 32px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .gold-accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #eab308 0%, #facc15 50%, #eab308 100%);
      width: 100%;
    }
    .header {
      background-color: #ffffff;
      padding: 32px 28px 20px 28px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-img {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      display: inline-block;
      object-fit: contain;
      vertical-align: middle;
    }
    .header-logo-text {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 12px 0 0 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .header-subtext {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin: 4px 0 0 0;
    }
    .content {
      padding: 32px 28px;
      background-color: #ffffff;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 18px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 20px 0;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .info-row {
      padding: 8px 0;
      font-size: 13px;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
      width: 35%;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .border-top {
      border-top: 1px solid #e2e8f0;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }
    .security-notice p {
      margin: 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.55;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 28px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .footer-hotline {
      color: #475569;
      margin-bottom: 8px;
    }
    .footer-hotline strong {
      color: #0f172a;
    }
    .footer-legal {
      color: #94a3b8;
      font-size: 10px;
      margin-top: 6px;
    }
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 12px 8px !important;
      }
      .container {
        width: 100% !important;
        border-radius: 8px !important;
      }
      .content {
        padding: 24px 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <div class="container">
            <div class="gold-accent-bar"></div>
            <div class="header">
              <div style="text-align: center;">
                <img src="${logoSrc}" alt="LECO Logo" class="logo-img" width="70" height="70" />
              </div>
              <p class="header-logo-text">LECO Smart Electricity</p>
              <p class="header-subtext">Lanka Electricity Company (Pvt) Ltd &bull; Customer Security</p>
            </div>

            <div class="content">
              <span class="badge">Security Alert: Account Sign-in</span>
              <div class="greeting">${greeting}</div>
              <p class="description">
                A new sign-in was detected for your LECO Smart Electricity account. We provide this notification to assist you in keeping your account safe and monitored.
              </p>

              <div class="info-card">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td class="info-label info-row">Account Email</td>
                    <td class="info-value info-row">${accountEmail}</td>
                  </tr>
                  <tr>
                    <td class="info-label info-row border-top">Date and Time</td>
                    <td class="info-value info-row border-top">${loginTime}</td>
                  </tr>
                  <tr>
                    <td class="info-label info-row border-top">IP Address</td>
                    <td class="info-value info-row border-top">${ipAddress}</td>
                  </tr>
                  ${userAgent ? `
                  <tr>
                    <td class="info-label info-row border-top">Device / Client</td>
                    <td class="info-value info-row border-top">${userAgent}</td>
                  </tr>` : ''}
                  <tr>
                    <td class="info-label info-row border-top">Status</td>
                    <td class="info-value info-row border-top" style="color: #15803d;">Successful Sign-in</td>
                  </tr>
                </table>
              </div>

              <div class="security-notice">
                <p>
                  <strong>Did you sign in?</strong> If this was you, you can safely ignore this alert. No password reset code was requested or issued for this login.
                </p>
                <p style="margin-top: 8px;">
                  <strong>Not you?</strong> If you did not perform this login, please secure your account immediately by changing your password on the LECO portal and contacting our 24/7 Security Hotline at <strong>1987</strong>.
                </p>
              </div>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 12px; color: #64748b; line-height: 1.6;">
                Need assistance? Our 24/7 technical operations team is available at hotline <strong style="color: #0f172a;">1987</strong> or customer support at <strong style="color: #0f172a;">1910</strong>.
              </div>
            </div>

            <div class="footer">
              <div class="footer-title">Lanka Electricity Company (Private) Limited</div>
              <div class="footer-hotline">
                24/7 Breakdown Hotline: <strong>1987</strong> &bull; Customer Care: <strong>1910</strong> &bull; Portal: <a href="https://leco.lk" style="color: #0284c7; text-decoration: none; font-weight: 600;">www.leco.lk</a>
              </div>
              <div class="footer-legal">
                Head Office: No. 411, Galle Road, Colombo 03, Sri Lanka<br>
                This is an automated system security notification from LECO AMI Smart Infrastructure. Please do not reply directly to this email.
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>
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
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, error_message)
           VALUES ($1, $2, $3, 'pending_config', 'SMTP sender credentials not configured in Staff Portal or .env')`,
          [cleanTo, subject, purpose]
        );
      }
    } catch (_) {}

    return {
      success: false,
      notConfigured: true,
      error: 'Email gateway credentials are not configured in Staff Portal or environment variables'
    };
  }

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;
  const logoAtt = getLogoAttachment();
  const mailAttachments = logoAtt ? [logoAtt] : [];

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: textContent,
      html: htmlContent,
      attachments: mailAttachments
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
 * Dispatches an account sign-in alert email to recipient (Zero emojis, official security alert)
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.recipientName] - Customer or staff name
 * @param {string} [params.loginTime] - Formatted timestamp
 * @param {string} [params.ipAddress] - Client IP address
 * @param {string} [params.userAgent] - Browser or portal client
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendLoginAttemptAlertEmail({
  to,
  recipientName = '',
  loginTime,
  ipAddress = '127.0.0.1',
  userAgent = 'Web Browser'
}) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Valid recipient email address is required' };
  }

  const cleanTo = to.trim().toLowerCase();
  const timeFormatted = loginTime || new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const subject = 'LECO Security Alert: Successful Account Login';
  const htmlContent = buildLoginAttemptEmailHtml({
    recipientName,
    accountEmail: cleanTo,
    loginTime: timeFormatted,
    ipAddress,
    userAgent
  });

  const textContent = `LECO Security Alert: Successful Account Login\n\nDear ${recipientName || 'Customer'},\n\nA successful sign-in was recorded for your LECO Smart Electricity account (${cleanTo}).\n\nDate and Time: ${timeFormatted}\nIP Address: ${ipAddress}\nDevice / Client: ${userAgent}\nStatus: Successful Sign-in\n\nIf this was you, you may safely ignore this email. Note that password reset codes are never sent on login and are only issued when requested via Forgot Password.\n\nIf this was not you, please immediately secure your account and call LECO Hotline at 1987.\n\nLanka Electricity Company (Pvt) Ltd`;

  const { transporter, creds } = await getTransporter();

  if (!transporter || !creds.isConfigured) {
    console.warn(`[EmailService] SMTP not configured. Login alert for ${cleanTo} skipped.`);
    return { success: false, error: 'SMTP credentials not configured' };
  }

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;
  const logoAtt = getLogoAttachment();
  const mailAttachments = logoAtt ? [logoAtt] : [];

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: textContent,
      html: htmlContent,
      attachments: mailAttachments
    });

    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, message_id)
           VALUES ($1, $2, 'login_alert', 'sent', $3)`,
          [cleanTo, subject, info.messageId]
        );
      }
    } catch (_) {}

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EmailService] Error sending login alert email to ${cleanTo}:`, err.message);
    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, error_message)
           VALUES ($1, $2, 'login_alert', 'failed', $3)`,
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
  const htmlContent = buildTestDiagnosticEmailHtml({ creds, timestamp });

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;
  const logoAtt = getLogoAttachment();
  const mailAttachments = logoAtt ? [logoAtt] : [];

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: `LECO Email Gateway Connectivity Test\n\nStatus: Connected Successfully\nSender: ${creds.user}\nHost: ${creds.host}:${creds.port}\nTimestamp: ${timestamp}`,
      html: htmlContent,
      attachments: mailAttachments
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
      cleanPass = (existing.rows[0].app_password || '').replace(/\s+/g, '');
    } else if (process.env.SMTP_PASS) {
      cleanPass = process.env.SMTP_PASS.trim().replace(/\s+/g, '');
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
 * Sends a generic HTML or text email (e.g. for customer welcome, statements, alerts)
 */
async function sendHtmlEmail({ to, subject, htmlBody, html, text, purpose = 'notification' }) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Valid recipient email address is required' };
  }

  const cleanTo = to.trim().toLowerCase();
  const { transporter, creds } = await getTransporter();

  if (!transporter || !creds.isConfigured) {
    console.warn(`[EmailService] SMTP not configured. HTML email to ${cleanTo} skipped.`);
    return { success: false, error: 'SMTP sender credentials not configured' };
  }

  const fromAddress = process.env.EMAIL_FROM || `"LECO Smart Electricity" <${creds.user}>`;
  const body = htmlBody || html || '';
  const logoAtt = getLogoAttachment();
  const mailAttachments = logoAtt ? [logoAtt] : [];

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanTo,
      subject,
      text: text || '',
      html: body,
      attachments: mailAttachments
    });

    try {
      const pool = getPool();
      if (pool) {
        await pool.query(
          `INSERT INTO email_logs (recipient, subject, purpose, status, message_id)
           VALUES ($1, $2, $3, 'sent', $4)`,
          [cleanTo, subject, purpose, info.messageId]
        );
      }
    } catch (_) {}

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EmailService] Error sending HTML email to ${cleanTo}:`, err.message);
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
 * Initializes email_settings and email_logs tables in PostgreSQL if they don't exist.
 * Also seeds with .env SMTP credentials if email_settings has no active rows.
 */
async function initializeEmailSettingsTable() {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id SERIAL PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        app_password VARCHAR(255) NOT NULL,
        smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
        smtp_port INTEGER DEFAULT 465,
        smtp_secure BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        purpose VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        message_id VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if table has active configuration; if not and env credentials exist, seed it
    const countRes = await pool.query('SELECT COUNT(*) FROM email_settings WHERE is_active = TRUE');
    const rowCount = countRes?.rows?.[0]?.count;
    if (rowCount !== undefined && parseInt(rowCount, 10) === 0) {
      const envUser = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
      const envPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');
      const envHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const envPort = parseInt(process.env.SMTP_PORT || '465', 10);
      if (envUser && envPass) {
        await pool.query(
          `INSERT INTO email_settings (sender_email, app_password, smtp_host, smtp_port, is_active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [envUser, envPass, envHost, envPort]
        );
        console.log(`[EmailService] Seeded email_settings table from .env with ${envUser}`);
      }
    }
  } catch (err) {
    console.warn('[EmailService] initializeEmailSettingsTable warning:', err.message);
  }
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
  buildTestDiagnosticEmailHtml,
  buildCustomerWelcomeEmailHtml,
  buildLoginAttemptEmailHtml,
  getLogoAttachment,
  LOGO_CID,
  sendOtpEmail,
  sendLoginAttemptAlertEmail,
  sendHtmlEmail,
  sendTestEmail,
  getEmailConfigStatus,
  saveEmailConfig,
  getEmailLogs,
  initializeEmailSettingsTable,
  invalidateTransporterCache
};
