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

function createMockReqRes({ body = {}, params = {}, query = {}, user = null } = {}) {
  const req = { body, params, query, user, cookies: {} };
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

  before(async () => {
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

  test('6. customerLogin succeeds with newly entered password and fails with old password', async () => {
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
  });
});
