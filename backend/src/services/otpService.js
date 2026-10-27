const { createHmac, randomInt } = require('node:crypto');

function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

function hashOtp(otp) {
  const secret = process.env.OTP_PEPPER || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('OTP_PEPPER or a 32-character JWT_SECRET must be configured.');
  }
  return createHmac('sha256', secret).update(String(otp)).digest('hex');
}

function isValidOtpFormat(otp) {
  return typeof otp === 'string' && /^\d{6}$/.test(otp);
}

module.exports = { generateOtp, hashOtp, isValidOtpFormat };
