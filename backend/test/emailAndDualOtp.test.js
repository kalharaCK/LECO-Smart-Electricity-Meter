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

test('getLogoAttachment returns valid CID attachment object for LECO logo', () => {
  const attachment = emailService.getLogoAttachment();
  assert.ok(attachment, 'Logo attachment should be resolved');
  assert.equal(attachment.filename, 'leco-logo.png');
  assert.equal(attachment.cid, emailService.LOGO_CID);
  assert.ok(attachment.path.includes('leco-logo.png'));
});

test('buildOtpEmailHtml includes official LECO logo and professional gold accent bar', () => {
  const html = emailService.buildOtpEmailHtml({
    otp: '556677',
    purpose: 'registration',
    recipientName: 'Kamal'
  });

  assert.ok(html.includes(`src="cid:${emailService.LOGO_CID}"`), 'Must include CID reference to logo');
  assert.ok(html.includes('gold-accent-bar'), 'Must include corporate gold accent stripe');
  assert.ok(html.includes('LECO Smart Electricity'), 'Must include brand title');
  assert.ok(html.includes('Lanka Electricity Company (Pvt) Ltd'), 'Must include company name');
});

test('buildTestDiagnosticEmailHtml renders matching professional layout with logo and zero emojis', () => {
  const html = emailService.buildTestDiagnosticEmailHtml({
    creds: { user: 'operations@leco.lk', host: 'smtp.gmail.com', port: 465, source: 'database' },
    timestamp: '2026-10-28 01:30:00'
  });

  assert.ok(html.includes(`src="cid:${emailService.LOGO_CID}"`), 'Must include logo in diagnostic email');
  assert.ok(html.includes('SMTP Connectivity Verified'), 'Must include verified badge');
  assert.ok(html.includes('operations@leco.lk'), 'Must include sender user');

  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(html), false, 'Diagnostic test email must contain zero emojis');
});

test('buildCustomerWelcomeEmailHtml renders professional customer onboarding email with logo and zero emojis', () => {
  const html = emailService.buildCustomerWelcomeEmailHtml({
    fullName: 'Anura Bandara',
    email: 'anura@example.com',
    nic: '851234567V',
    meter: { meter_number: 'LEC-778899', account_number: 'ACC-001122' }
  });

  assert.ok(html.includes(`src="cid:${emailService.LOGO_CID}"`), 'Must include logo in welcome email');
  assert.ok(html.includes('Anura Bandara'), 'Must include customer name');
  assert.ok(html.includes('anura@example.com'), 'Must include customer email');
  assert.ok(html.includes('851234567V'), 'Must include customer NIC');
  assert.ok(html.includes('LEC-778899'), 'Must include meter number');

  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(html), false, 'Welcome email must contain zero emojis');
});

