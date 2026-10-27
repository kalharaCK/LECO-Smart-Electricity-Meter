require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/db');
const authController = require('../src/controllers/authController');
const smsService = require('../src/services/smsService');
const emailService = require('../src/services/emailService');

test('SMS Failure & Error Fallback to Email OTP Suite', async (t) => {
  const originalSendEventSms = smsService.sendEventSms;
  const originalSendOtpEmail = emailService.sendOtpEmail;

  t.after(() => {
    smsService.sendEventSms = originalSendEventSms;
    emailService.sendOtpEmail = originalSendOtpEmail;
  });

  await t.test('1. sendRegisterOtp navigates with success: true and fallbackToEmail: true when SMS gateway errors', async () => {
    const timestamp = Date.now();
    const testEmail = `sms_err_reg_${timestamp}@leco.lk`;
    const testMobile = `077${timestamp.toString().slice(-7)}`;
    const testNic = `90${timestamp.toString().slice(-7)}V`;

    // Force SMS gateway to throw/reject
    smsService.sendEventSms = async () => {
      throw new Error('Connection refused by Text.lk SMS gateway');
    };

    let emailedCode = null;
    let emailedTo = null;
    emailService.sendOtpEmail = async (params) => {
      emailedCode = params.otp;
      emailedTo = params.to;
      return { success: true, messageId: 'mock-email-123' };
    };

    let statusCode = null;
    let jsonResponse = null;
    const req = {
      body: {
        full_name: 'SMS Error Test Customer',
        nic: testNic,
        address: '123 Galle Road, Colombo',
        mobile_number: testMobile,
        email: testEmail
      }
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      }
    };

    await authController.sendRegisterOtp(req, res);
    if (statusCode) console.log('sendRegisterOtp test 1 response:', statusCode, jsonResponse);

    assert.equal(statusCode, null, 'Should return HTTP 200 (not set to 500 error)');
    assert.equal(jsonResponse.success, true, 'Must return success: true so frontend advances to OTP screen');
    assert.equal(jsonResponse.smsDelivered, false, 'SMS delivery must indicate false');
    assert.equal(jsonResponse.fallbackToEmail, true, 'Must flag fallbackToEmail as true');
    assert.equal(jsonResponse.email, testEmail);
    assert.ok(jsonResponse.message.includes('SMS delivery delayed or unavailable'));
    assert.ok(emailedCode, 'Email OTP must have been generated and dispatched');
    assert.equal(emailedTo, testEmail);

    // Verify registration completes successfully using emailed OTP code
    let regStatusCode = null;
    let regJsonResponse = null;
    const regReq = {
      body: {
        full_name: 'SMS Error Test Customer',
        address: '123 Galle Road, Colombo',
        nic: testNic,
        mobile_number: testMobile,
        email: testEmail,
        password: 'Password123#Secure',
        otp: emailedCode
      }
    };
    const regRes = {
      status(code) {
        regStatusCode = code;
        return this;
      },
      cookie() {},
      json(data) {
        regJsonResponse = data;
        return this;
      }
    };

    await authController.registerWithProfile(regReq, regRes);
    assert.equal(regStatusCode, 201, 'Customer registration with emailed OTP code must succeed');
    assert.equal(regJsonResponse.success, true);
  });

  await t.test('2. sendForgotPasswordOtp navigates with success: true and fallbackToEmail: true when SMS gateway errors', async () => {
    const timestamp = Date.now();
    const testEmail = `sms_err_fp_${timestamp}@leco.lk`;
    const testMobile = `071${timestamp.toString().slice(-7)}`;
    const testNic = `88${timestamp.toString().slice(-7)}V`;

    // Create user in database
    await pool.query(
      `INSERT INTO users (email, password, role, full_name, mobile_number, nic)
       VALUES ($1, $2, 'customer', 'FP Test Customer', $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [testEmail, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', testMobile, testNic]
    );

    // Simulate SMS gateway total downtime
    smsService.sendEventSms = async () => {
      throw new Error('503 Service Unavailable: SMS Gateway Network Timeout');
    };

    let fpEmailedCode = null;
    emailService.sendOtpEmail = async (params) => {
      fpEmailedCode = params.otp;
      return { success: true, messageId: 'mock-fp-email-456' };
    };

    let fpStatusCode = null;
    let fpJsonResponse = null;
    const fpReq = {
      body: {
        email: testEmail,
        nic: testNic
      }
    };
    const fpRes = {
      status(code) {
        fpStatusCode = code;
        return this;
      },
      json(data) {
        fpJsonResponse = data;
        return this;
      }
    };

    await authController.sendForgotPasswordOtp(fpReq, fpRes);

    assert.equal(fpStatusCode, null, 'Should return HTTP 200 without throwing 500 error');
    assert.equal(fpJsonResponse.success, true, 'Must return success: true so user navigates to Step 2 OTP screen');
    assert.equal(fpJsonResponse.smsDelivered, false, 'SMS delivered must be false');
    assert.equal(fpJsonResponse.fallbackToEmail, true, 'Must set fallbackToEmail to true');
    assert.ok(fpEmailedCode, 'Emailed OTP code must have been sent to registered email');
    assert.ok(fpJsonResponse.message.includes('SMS delivery delayed or unavailable'));

    // Verify OTP confirmation with the emailed code
    let verifyJsonResponse = null;
    const verifyReq = {
      body: {
        email: testEmail,
        otp: fpEmailedCode
      }
    };
    const verifyRes = {
      status() { return this; },
      json(data) { verifyJsonResponse = data; return this; }
    };

    await authController.verifyForgotPasswordOtp(verifyReq, verifyRes);
    assert.equal(verifyJsonResponse.success, true, 'Emailed OTP must be valid and accepted');

    // Verify password reset using the emailed code
    let resetJsonResponse = null;
    const resetReq = {
      body: {
        email: testEmail,
        otp: fpEmailedCode,
        newPassword: 'BrandNewSecurePassword2026#'
      }
    };
    const resetRes = {
      status() { return this; },
      json(data) { resetJsonResponse = data; return this; }
    };

    await authController.resetPasswordWithOtp(resetReq, resetRes);
    assert.equal(resetJsonResponse.success, true, 'Password reset with emailed OTP must succeed');
  });

  await t.test('3. sendRegisterOtp succeeds when SMS hangs/times out past safe limit', async () => {
    const timestamp = Date.now();
    const testEmail = `sms_hang_${timestamp}@leco.lk`;
    const testMobile = `076${timestamp.toString().slice(-7)}`;
    const testNic = `75${timestamp.toString().slice(-7)}V`;

    // Simulate SMS hanging indefinitely (e.g. gateway socket stall)
    smsService.sendEventSms = () => new Promise((resolve) => {
      // Intentionally never resolves or takes 20s
      setTimeout(() => resolve({ success: true }), 20000);
    });

    let emailedOtp = null;
    emailService.sendOtpEmail = async (params) => {
      emailedOtp = params.otp;
      return { success: true, messageId: 'mock-hang-email' };
    };

    let jsonRes = null;
    const req = {
      body: {
        full_name: 'Hanging SMS Test',
        nic: testNic,
        address: 'Colombo',
        mobile_number: testMobile,
        email: testEmail
      }
    };
    const res = {
      status() { return this; },
      json(data) { jsonRes = data; return this; }
    };

    const startTime = Date.now();
    await authController.sendRegisterOtp(req, res);
    const duration = Date.now() - startTime;

    // Timeout is capped at 4000ms (verifying it does not wait for the 20s hang or 30s server limit)
    assert.ok(duration < 9000, `Must timeout quickly without hanging the user: took ${duration}ms`);
    assert.equal(jsonRes.success, true, 'User must navigate to OTP screen with success: true');
    assert.equal(jsonRes.smsDelivered, false, 'SMS delivered must be false after gateway timeout');
    assert.equal(jsonRes.fallbackToEmail, true);
    assert.ok(emailedOtp, 'Emailed OTP was successfully sent');
  });
});
