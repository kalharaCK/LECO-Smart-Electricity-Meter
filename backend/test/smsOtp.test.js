const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const smsService = require('../src/services/smsService');

test('phone number normalization formats local Sri Lankan numbers to 94XXXXXXXXX', () => {
  assert.equal(smsService.normalizePhoneNumber('0771234567'), '94771234567');
  assert.equal(smsService.normalizePhoneNumber('+94771234567'), '94771234567');
  assert.equal(smsService.normalizePhoneNumber('771234567'), '94771234567');
  assert.equal(smsService.normalizePhoneNumber('071-987-6543'), '94719876543');
  assert.equal(smsService.normalizePhoneNumber(''), '');
  assert.equal(smsService.normalizePhoneNumber(null), '');
});

test('trilingual SMS templates render expected tokens for registration and payments', () => {
  const regEn = smsService.SMS_TEMPLATES.otp_registration.en({ otp: '123456' });
  assert.ok(regEn.includes('123456'));
  assert.ok(regEn.includes('LECO Self Care'));

  const regSi = smsService.SMS_TEMPLATES.otp_registration.si({ otp: '654321' });
  assert.ok(regSi.includes('654321'));

  const payTa = smsService.SMS_TEMPLATES.payment.ta({ amount: '1500.00', ref: 'PAY-001', balance: '1250.00' });
  assert.ok(payTa.includes('1500.00'));
  assert.ok(payTa.includes('PAY-001'));
});

test('OTP generator produces 6-digit numeric strings', () => {
  for (let i = 0; i < 20; i++) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);
  }
});
