const crypto = require('crypto');

/**
 * PayHere Payment Gateway Helper Service
 * Computes checkout MD5 hashes and verifies PayHere IPN signatures.
 */

const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

/**
 * Get configured PayHere merchant credentials
 */
const getMerchantConfig = () => {
  const merchantId = process.env.PAYHERE_MERCHANT_ID || '1236689';
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'leco_payhere_merchant_secret_sandbox_2026';
  const isSandbox = process.env.PAYHERE_SANDBOX !== 'false';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  return {
    merchantId,
    merchantSecret,
    isSandbox,
    frontendUrl,
    backendUrl
  };
};

/**
 * Generate PayHere Checkout Security Hash (Required from 2023-01-16)
 * Formula: hash = UPPER(MD5(merchant_id + order_id + amount_formatted + currency + UPPER(MD5(merchant_secret))))
 */
const generateCheckoutHash = (orderId, amount, currency = 'LKR') => {
  const { merchantId, merchantSecret } = getMerchantConfig();
  const hashedSecret = md5(merchantSecret).toUpperCase();
  const amountFormatted = parseFloat(amount).toFixed(2);
  const rawString = `${merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`;
  const hash = md5(rawString).toUpperCase();

  return {
    merchantId,
    orderId,
    amountFormatted,
    currency,
    hash
  };
};

/**
 * Verify PayHere Server-to-Server IPN Notification Signature
 * Formula: md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
 */
const verifyNotificationSignature = ({
  merchant_id,
  order_id,
  payhere_amount,
  payhere_currency,
  status_code,
  md5sig
}) => {
  const { merchantSecret } = getMerchantConfig();
  const hashedSecret = md5(merchantSecret).toUpperCase();
  const rawString = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`;
  const localMd5Sig = md5(rawString).toUpperCase();

  const isValid = localMd5Sig === (md5sig || '').toUpperCase();
  return {
    isValid,
    localMd5Sig,
    receivedMd5Sig: md5sig
  };
};

module.exports = {
  getMerchantConfig,
  generateCheckoutHash,
  verifyNotificationSignature,
  md5
};
