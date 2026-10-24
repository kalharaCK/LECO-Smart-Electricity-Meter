const { pool } = require('../config/db');

const TEXT_LK_BASE_URL = 'https://app.text.lk/api/v3';

function getApiToken() {
  return (process.env.SMS_API_TOKEN || '').trim();
}

function getSenderId() {
  return (process.env.SMS_SENDER_ID || 'TextLKDemo').trim();
}

/**
 * Normalizes Sri Lankan mobile numbers into standard 94XXXXXXXXX format
 * e.g., 0712345678 -> 94712345678
 *       +94712345678 -> 94712345678
 *       712345678 -> 94712345678
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.substring(1);
  } else if (!cleaned.startsWith('94') && cleaned.length === 9) {
    cleaned = '94' + cleaned;
  }
  return cleaned;
}

/**
 * High-Clarity, Trilingual SMS Templates
 * Strictly compact and clear to fit within single SMS limits
 */
const SMS_TEMPLATES = {
  otp_registration: {
    en: (d) => `LECO Self Care: Your registration OTP is ${d.otp}. Valid for 5 min. Do not share.`,
    si: (d) => `LECO: ඔබගේ ලියාපදිංචි OTP අංකය ${d.otp} වේ. විනාඩි 5ක් වලංගුයි.`,
    ta: (d) => `LECO: உங்கள் பதிவுக்கான OTP ${d.otp}. 5 நிமிடங்களுக்கு செல்லுபடியாகும்.`
  },
  otp_forgot_password: {
    en: (d) => `LECO Self Care: Your password reset OTP is ${d.otp}. Valid for 5 min. Do not share.`,
    si: (d) => `LECO: මුරපදය යළි සැකසීමේ OTP අංකය ${d.otp} වේ. විනාඩි 5ක් වලංගුයි.`,
    ta: (d) => `LECO: கடவுச்சொல் மீட்டமைப்பு OTP ${d.otp}. 5 நிமிடங்களுக்கு செல்லுபடியாகும்.`
  },
  login_attempt: {
    en: (d) => `LECO Alert: Account login detected at ${d.time || 'now'}. If not you, please call 1987.`,
    si: (d) => `LECO දැනුම්දීම: ගිණුමට ඇතුළු වීමක් ${d.time || 'දැන්'} වාර්තා විය. ඔබ නොවේ නම් 1987 අමතන්න.`,
    ta: (d) => `LECO எச்சரிக்கை: ${d.time || 'இப்போது'} உள்நுழைவு நிகழ்ந்தது. நீங்கள் இல்லையெனில் 1987 ஐ அழைக்கவும்.`
  },
  payment: {
    en: (d) => `LECO Self Care: Paid LKR ${d.amount} for A/C ${d.account_no || 'ACC'}. Ref: ${d.ref || 'PAY'}. Bal: LKR ${d.balance || '0.00'}. Thank you.`,
    si: (d) => `LECO: ${d.account_no || 'ගිණුම'} ට රු.${d.amount} ගෙවීම සාර්ථකයි. අංකය: ${d.ref || 'PAY'}. නව ශේෂය: රු.${d.balance || '0.00'}. ස්තූතියි.`,
    ta: (d) => `LECO: கணக்கு ${d.account_no || 'ACC'} இற்கு ரூ.${d.amount} பெறப்பட்டது. குறிப்பு: ${d.ref || 'PAY'}. இருப்பு: ரூ.${d.balance || '0.00'}. நன்றி.`
  },
  low_balance: {
    en: (d) => `LECO Alert: Low balance on A/C ${d.account_no || 'ACC'}. Current: LKR ${d.balance}. Reload now at leco.lk to avoid cutoff.`,
    si: (d) => `LECO අනතුරු ඇඟවීම: ${d.account_no || 'ගිණුමේ'} ශේෂය රු.${d.balance} කි. විසන්ධිවීම් වලක්වා ගැනීමට වහාම මුදල් පුරවන්න.`,
    ta: (d) => `LECO எச்சரிக்கை: கணக்கு ${d.account_no || 'ACC'} இல் இருப்பு ரூ.${d.balance}. துண்டிக்கப்படுவதைத் தவிர்க்க உடனே ரீசார்ஜ் செய்யவும்.`
  },
  relay_command: {
    en: (d) => `LECO Notice: Power supply for meter ${d.account_no} is now ${d.status}. Helpline: 1987.`,
    si: (d) => `LECO: ${d.account_no} මීටරයේ විදුලි සැපයුම ${d.status} කර ඇත. විස්තර: 1987.`,
    ta: (d) => `LECO: மீட்டர் ${d.account_no} மின் இணைப்பு ${d.status} செய்யப்பட்டுள்ளது. உதவி: 1987.`
  }
};

/**
 * Formats a message using registered templates and language
 */
function formatMessage(templateKey, lang = 'en', data = {}) {
  const chosenLang = lang === 'si' || lang === 'ta' ? lang : 'en';
  const group = SMS_TEMPLATES[templateKey];
  if (!group) {
    return data.message || `LECO Alert: Notification from Lanka Electricity Company.`;
  }
  const generator = group[chosenLang] || group.en;
  return generator(data);
}

/**
 * Send an SMS message through Text.lk Gateway
 */
async function sendSms({
  recipient,
  message,
  type = 'plain',
  eventType = 'custom',
  language = 'en',
  metadata = {}
}) {
  const token = getApiToken();
  const senderId = getSenderId();
  const normalizedRecipient = normalizePhoneNumber(recipient);

  if (!normalizedRecipient) {
    console.warn('[SMS Service] Missing or invalid recipient number:', recipient);
    return { success: false, error: 'Invalid recipient mobile number' };
  }

  if (!message || !message.trim()) {
    return { success: false, error: 'Empty message text' };
  }

  // Detect Unicode for Sinhala / Tamil characters
  const hasUnicode = /[\u0D80-\u0DFF\u0B80-\u0BFF]/.test(message);
  const resolvedType = hasUnicode ? 'unicode' : (type || 'plain');

  let providerStatus = 'unknown';
  let providerUid = null;
  let providerCost = 0;
  let errorMessage = null;
  let rawResponse = null;

  try {
    if (!token) {
      console.warn('[SMS Service] SMS_API_TOKEN is not configured in .env. Skipping external gateway call.');
      errorMessage = 'SMS_API_TOKEN not configured';
      providerStatus = 'skipped_no_token';
    } else {
      console.log(`[SMS Service] Dispatching ${resolvedType} SMS to ${normalizedRecipient} (Sender: ${senderId})...`);

      const response = await fetch(`${TEXT_LK_BASE_URL}/sms/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: normalizedRecipient,
          sender_id: senderId,
          type: resolvedType,
          message: message.trim()
        })
      });

      rawResponse = await response.json();

      if (response.ok && rawResponse && rawResponse.status === 'success') {
        providerStatus = 'delivered';
        if (typeof rawResponse.data === 'object' && rawResponse.data !== null) {
          providerUid = rawResponse.data.uid || (Array.isArray(rawResponse.data) ? rawResponse.data[0]?.uid : null);
          providerCost = Number(rawResponse.data.cost || 1);
        }
        console.log(`[SMS Service] Successfully dispatched SMS to ${normalizedRecipient}. Status: success`);
      } else {
        providerStatus = 'failed';
        errorMessage = rawResponse?.message || `Gateway returned HTTP ${response.status}`;
        console.warn(`[SMS Service] Text.lk Gateway error for ${normalizedRecipient}:`, errorMessage);
      }
    }
  } catch (err) {
    providerStatus = 'failed';
    errorMessage = err.message;
    console.error(`[SMS Service] Network error sending SMS to ${normalizedRecipient}:`, err.message);
  }

  // Persist record to sms_logs table
  try {
    const insertRes = await pool.query(
      `INSERT INTO sms_logs (recipient, sender_id, event_type, language, message, status, provider_uid, cost, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, created_at`,
      [
        normalizedRecipient,
        senderId,
        eventType,
        language || 'en',
        message.trim(),
        providerStatus,
        providerUid,
        providerCost,
        errorMessage,
        JSON.stringify({ ...metadata, rawResponse })
      ]
    );

    return {
      success: providerStatus === 'delivered',
      logId: insertRes.rows[0]?.id,
      status: providerStatus,
      recipient: normalizedRecipient,
      providerUid,
      errorMessage
    };
  } catch (dbErr) {
    console.error('[SMS Service] Failed to write to sms_logs:', dbErr.message);
    return {
      success: providerStatus === 'delivered',
      status: providerStatus,
      recipient: normalizedRecipient,
      providerUid,
      errorMessage: errorMessage || dbErr.message
    };
  }
}

/**
 * High-level helper to send standardized event SMS
 * (e.g. otp, login_attempt, payment, low_balance, relay_command)
 */
async function sendEventSms({
  recipient,
  eventType,
  eventSubtype,
  language = 'en',
  data = {},
  metadata = {}
}) {
  const templateKey = eventSubtype ? `${eventType}_${eventSubtype}` : eventType;
  const message = formatMessage(templateKey, language, data);

  return sendSms({
    recipient,
    message,
    eventType: templateKey,
    language,
    metadata: { ...metadata, data }
  });
}

/**
 * Fetch Text.lk SMS units balance
 */
async function getBalance() {
  const token = getApiToken();
  if (!token) {
    return { status: 'error', message: 'SMS_API_TOKEN is not configured' };
  }

  try {
    const response = await fetch(`${TEXT_LK_BASE_URL}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    return await response.json();
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Fetch Text.lk user profile
 */
async function getProfile() {
  const token = getApiToken();
  if (!token) {
    return { status: 'error', message: 'SMS_API_TOKEN is not configured' };
  }

  try {
    const response = await fetch(`${TEXT_LK_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    return await response.json();
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Retrieve recent SMS logs from the database
 */
async function getSmsLogs({ limit = 50, offset = 0, eventType = null } = {}) {
  try {
    let query = `
      SELECT id, recipient, sender_id, event_type, language, message, status, provider_uid, cost, error_message, metadata, created_at
      FROM sms_logs
    `;
    const params = [];
    if (eventType && eventType !== 'all') {
      params.push(eventType);
      query += ` WHERE event_type = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    // Also calculate summary statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int AS total_delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS total_failed,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END)::int AS sent_today
      FROM sms_logs
    `);

    return {
      success: true,
      logs: result.rows,
      stats: statsResult.rows[0] || { total_sent: 0, total_delivered: 0, total_failed: 0, sent_today: 0 }
    };
  } catch (err) {
    console.error('[SMS Service] Error querying sms_logs:', err);
    return { success: false, error: err.message, logs: [], stats: {} };
  }
}

module.exports = {
  sendSms,
  sendEventSms,
  formatMessage,
  normalizePhoneNumber,
  getBalance,
  getProfile,
  getSmsLogs,
  SMS_TEMPLATES
};
