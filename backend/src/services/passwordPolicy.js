const MIN_PASSWORD_LENGTH = 10;
const MAX_BCRYPT_BYTES = 72;

function validateNewPassword(password) {
  if (typeof password !== 'string') return 'Password must be text.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_BYTES) return `Password must be no more than ${MAX_BCRYPT_BYTES} UTF-8 bytes.`;
  return null;
}

module.exports = { MIN_PASSWORD_LENGTH, MAX_BCRYPT_BYTES, validateNewPassword };
