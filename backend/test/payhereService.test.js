const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PAYHERE_MERCHANT_ID = 'test-merchant';
process.env.PAYHERE_MERCHANT_SECRET = 'test-secret-only-for-unit-tests';

const {
  generateCheckoutHash,
  verifyNotificationSignature,
  md5,
} = require('../src/services/payhereService');

test('checkout hash formats amount and binds the order, merchant, and currency', () => {
  const checkout = generateCheckoutHash('order-123', 100, 'LKR');
  const secretHash = md5(process.env.PAYHERE_MERCHANT_SECRET).toUpperCase();
  const expected = md5(`test-merchantorder-123100.00LKR${secretHash}`).toUpperCase();

  assert.equal(checkout.amountFormatted, '100.00');
  assert.equal(checkout.hash, expected);
});

test('IPN signature accepts a valid signature and rejects tampering', () => {
  const fields = {
    merchant_id: 'test-merchant',
    order_id: 'order-123',
    payhere_amount: '100.00',
    payhere_currency: 'LKR',
    status_code: '2',
  };
  const secretHash = md5(process.env.PAYHERE_MERCHANT_SECRET).toUpperCase();
  const signature = md5(`${fields.merchant_id}${fields.order_id}${fields.payhere_amount}${fields.payhere_currency}${fields.status_code}${secretHash}`).toUpperCase();

  assert.equal(verifyNotificationSignature({ ...fields, md5sig: signature }).isValid, true);
  const tamperedSignature = `${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`;
  assert.equal(verifyNotificationSignature({ ...fields, md5sig: tamperedSignature }).isValid, false);
  assert.equal(verifyNotificationSignature({ ...fields, md5sig: 'short' }).isValid, false);
});

test('checkout creation fails when merchant credentials are missing', () => {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  delete process.env.PAYHERE_MERCHANT_ID;
  delete process.env.PAYHERE_MERCHANT_SECRET;

  try {
    assert.throws(() => generateCheckoutHash('order-123', 100), /must be configured/);
  } finally {
    process.env.PAYHERE_MERCHANT_ID = merchantId;
    process.env.PAYHERE_MERCHANT_SECRET = merchantSecret;
  }
});
