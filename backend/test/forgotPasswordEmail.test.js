require('dotenv').config();
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { 
  sendForgotPasswordOtp, 
  verifyForgotPasswordOtp, 
  resetPasswordWithOtp,
  customerLogin 
} = require('../src/controllers/authController');
const emailService = require('../src/services/emailService');

function createMockReqRes({ body = {}, params = {}, query = {}, user = null } = {}) {
  const req = { body, params, query, user, cookies: {}, headers: { 'user-agent': 'Automated Test Agent' }, ip: '127.0.0.1' };
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    cookie(name, val, options) {
      this.cookies = this.cookies || {};
      this.cookies[name] = { val, options };
      return this;
    }
  };
  return { req, res };
}

describe('Forgot Password Email OTP & Password Reset Suite', () => {
  const testEmail = `test_fp_${Date.now()}@leco.lk`;
  const initialPassword = 'InitialSecurePassword123!';
  const updatedPassword = 'BrandNewSecurePassword456!';
  const testNic = '199245678912';
  const testMobile = '+94770001122';
  let createdUserId = null;

  let originalSendOtpEmail;
  let originalSendLoginAlert;
  const capturedOtpEmails = [];
  const capturedLoginAlerts = [];

  before(async () => {
    // Mock emailService methods to prevent sending real live SMTP emails and prevent bounce-backs
    originalSendOtpEmail = emailService.sendOtpEmail;
    originalSendLoginAlert = emailService.sendLoginAttemptAlertEmail;

    emailService.sendOtpEmail = async (params) => {
      capturedOtpEmails.push(params);
      return { success: true, messageId: 'mock-fp-otp-message-id' };
    };

    emailService.sendLoginAttemptAlertEmail = async (params) => {
      capturedLoginAlerts.push(params);
      return { success: true, messageId: 'mock-login-alert-message-id' };
    };

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(initialPassword, salt);
    const ins = await pool.query(
      `INSERT INTO users (email, password, role, full_name, mobile_number, nic, email_verified)
       VALUES ($1, $2, 'customer', 'FP Test Customer', $3, $4, TRUE)
       RETURNING id`,
      [testEmail, hashed, testMobile, testNic]
    );
    createdUserId = ins.rows[0].id;
  });

  after(async () => {
    // Restore mocked emailService methods
    if (originalSendOtpEmail) emailService.sendOtpEmail = originalSendOtpEmail;
    if (originalSendLoginAlert) emailService.sendLoginAttemptAlertEmail = originalSendLoginAlert;

    if (createdUserId) {
      await pool.query('DELETE FROM verification_otps WHERE identifier IN ($1, $2)', [testEmail, testNic]);
      await pool.query('DELETE FROM users WHERE id = $1', [createdUserId]);
    }
  });

  test('1. sendForgotPasswordOtp sends OTP directly to specified email address', async () => {
    const { req, res } = createMockReqRes({
      body: { email: testEmail }
    });

    await sendForgotPasswordOtp(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.email, testEmail);
    assert.ok(res.data.message.includes('Verification code sent'));

    // Verify OTP email was intercepted by mock and not sent out via live SMTP
    assert.equal(capturedOtpEmails.length, 1);
    assert.equal(capturedOtpEmails[0].to, testEmail);
    assert.equal(capturedOtpEmails[0].purpose, 'forgot_password');

    // Verify OTP record exists in DB for this email
    const otps = await pool.query(
      `SELECT * FROM verification_otps WHERE identifier = $1 AND purpose = 'forgot_password'`,
      [testEmail]
    );
    assert.ok(otps.rows.length > 0);
  });

  test('2. sendForgotPasswordOtp rejects when provided NIC does not match account', async () => {
    const { req, res } = createMockReqRes({
      body: { email: testEmail, nic: '999999999V' }
    });

    await sendForgotPasswordOtp(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.error, /does not match the registered account details/i);
  });

  test('3. resetPasswordWithOtp rejects password shorter than 10 characters', async () => {
    // Generate valid OTP
    const otps = await pool.query(
      `SELECT otp_code, otp_hash FROM verification_otps WHERE identifier = $1 AND purpose = 'forgot_password' ORDER BY id DESC LIMIT 1`,
      [testEmail]
    );
    const { req, res } = createMockReqRes({
      body: { 
        email: testEmail, 
        otp: '123456', 
        newPassword: 'short' 
      }
    });

    await resetPasswordWithOtp(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, /at least 10 characters/i);
  });

  test('4. verifyForgotPasswordOtp confirms valid OTP', async () => {
    // Insert a known OTP for testEmail
    const knownOtp = '654321';
    const { hashOtp } = require('../src/services/otpService');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
       VALUES ('forgot_password', $1, $2, $3)`,
      [testEmail, hashOtp(knownOtp), expiresAt]
    );

    const { req, res } = createMockReqRes({
      body: { email: testEmail, otp: knownOtp }
    });

    await verifyForgotPasswordOtp(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
  });

  test('5. resetPasswordWithOtp successfully updates password for customer account', async () => {
    const resetOtp = '889900';
    const { hashOtp } = require('../src/services/otpService');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      `INSERT INTO verification_otps (purpose, identifier, otp_hash, expires_at)
       VALUES ('forgot_password', $1, $2, $3)`,
      [testEmail, hashOtp(resetOtp), expiresAt]
    );

    const { req, res } = createMockReqRes({
      body: { 
        email: testEmail, 
        otp: resetOtp, 
        newPassword: updatedPassword 
      }
    });

    await resetPasswordWithOtp(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.email, testEmail);

    // Verify OTP was consumed
    const checkOtp = await pool.query(
      `SELECT verified FROM verification_otps WHERE identifier = $1 AND purpose = 'forgot_password' AND verified = FALSE`,
      [testEmail]
    );
    assert.equal(checkOtp.rows.length, 0);
  });

  test('6. customerLogin succeeds with newly entered password and dispatches login security alert without reset code', async () => {
    const initialAlertCount = capturedLoginAlerts.length;
    const initialOtpCount = capturedOtpEmails.length;

    // Attempt with old password -> must fail
    const oldAttempt = createMockReqRes({
      body: { email: testEmail, password: initialPassword }
    });
    await customerLogin(oldAttempt.req, oldAttempt.res);
    assert.equal(oldAttempt.res.statusCode, 400);
    assert.match(oldAttempt.res.data.error, /invalid email or password/i);

    // Attempt with newly set password -> must succeed
    const newAttempt = createMockReqRes({
      body: { email: testEmail, password: updatedPassword }
    });
    await customerLogin(newAttempt.req, newAttempt.res);
    assert.equal(newAttempt.res.statusCode, 200);
    assert.equal(newAttempt.res.data.success, true);
    assert.equal(newAttempt.res.data.user.email, testEmail);

    // Verify that login triggered a login security alert email, NOT a password reset OTP
    assert.ok(capturedLoginAlerts.length > initialAlertCount, 'Login must dispatch a login security alert email');
    assert.equal(capturedLoginAlerts[capturedLoginAlerts.length - 1].to, testEmail);
    assert.equal(capturedOtpEmails.length, initialOtpCount, 'Login must NEVER trigger an OTP or password reset email');
  });

  test('7. Login attempt alert email template conforms to security rules and contains zero emojis', () => {
    const html = emailService.buildLoginAttemptEmailHtml({
      recipientName: 'FP Test Customer',
      accountEmail: testEmail,
      loginTime: '28/10/2026, 10:15',
      ipAddress: '192.168.1.100',
      userAgent: 'LECO Customer Portal / Mozilla 5.0'
    });

    assert.ok(html.includes(testEmail), 'Must contain user email');
    assert.ok(html.includes('192.168.1.100'), 'Must contain IP address');
    assert.ok(html.includes('1987'), 'Must contain hotline 1987');
    assert.ok(html.includes('Security Alert: Account Sign-in'), 'Must contain security badge');
    assert.ok(!html.includes('Password Reset Code'), 'Login alert must NOT ask for password reset code');

    // Rule: 1.Dont use imojies in UI designs
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.equal(emojiRegex.test(html), false, 'Login attempt alert email must contain zero emojis');
  });
});
