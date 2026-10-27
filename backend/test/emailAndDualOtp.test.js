const test = require('node:test');
const assert = require('node:assert/strict');
const emailService = require('../src/services/emailService');

test('buildOtpEmailHtml renders valid HTML with OTP and zero emojis', () => {
  const otp = '849201';
  const html = emailService.buildOtpEmailHtml({
    otp,
    purpose: 'registration',
    recipientName: 'Kavindu Perera',
    expiresMinutes: 10
  });

  // Verify core contents
  assert.ok(html.includes(otp), 'HTML must contain the OTP');
  assert.ok(html.includes('Kavindu Perera'), 'HTML must include recipient name');
  assert.ok(html.includes('LECO Smart Electricity'), 'HTML must include LECO branding');
  assert.ok(html.includes('1987'), 'HTML must include 24/7 hotline 1987');
  assert.ok(html.includes('10 minutes'), 'HTML must display expiry window');

  // Verify strict zero emoji rule
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(html), false, 'HTML email must contain zero emojis');
});

test('buildOtpEmailHtml formats forgot_password and verify_email purposes correctly', () => {
  const forgotHtml = emailService.buildOtpEmailHtml({
    otp: '112233',
    purpose: 'forgot_password',
    recipientName: 'Sunil',
    expiresMinutes: 10
  });
  assert.ok(forgotHtml.includes('Password Reset'), 'Forgot password must have password reset badge');
  assert.ok(forgotHtml.includes('112233'), 'Forgot password must contain code');

  const verifyHtml = emailService.buildOtpEmailHtml({
    otp: '445566',
    purpose: 'verify_email',
    recipientName: 'Nimal',
    expiresMinutes: 10
  });
  assert.ok(verifyHtml.includes('Email Address Verification'), 'Verify email must have verification title');
  assert.ok(verifyHtml.includes('445566'), 'Verify email must contain code');
});

test('resolveSmtpCredentials strips spaces from Gmail app passwords', async () => {
  const originalPass = process.env.SMTP_PASS;
  const originalUser = process.env.SMTP_USER;

  try {
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop'; // Spaced Gmail app password
    const creds = await emailService.resolveSmtpCredentials();
    assert.equal(creds.pass, 'abcdefghijklmnop', 'Whitespace must be stripped from Gmail app password');
  } finally {
    process.env.SMTP_PASS = originalPass;
    process.env.SMTP_USER = originalUser;
  }
});
