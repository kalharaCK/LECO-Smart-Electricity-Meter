/**
 * Chat Action & Menu Mention Detector
 * Detects appropriate interactive navigation buttons for the customer dashboard
 * based on conversation intent, live user context, and target language.
 */

const ACTION_LABELS = {
  payments: {
    en: "Recharge Balance",
    si: "ශේෂය රීචාර්ජ් කරන්න",
    ta: "இப்போது ரீசார்ஜ் செய்க"
  },
  history: {
    en: "View History",
    si: "ගෙවීම් ඉතිහාසය බලන්න",
    ta: "கட்டண வரலாறு பார்க்க"
  },
  complaints: {
    en: "Lodge Complaint",
    si: "පැමිණිල්ලක් ඉදිරිපත් කරන්න",
    ta: "புகார் பதிவு செய்க"
  },
  settings: {
    en: "Account Settings",
    si: "ගිණුම් සැකසුම්",
    ta: "கணக்கு அமைப்புகள்"
  },
  addMeter: {
    en: "Add Meter",
    si: "මීටරය එක් කරන්න",
    ta: "மீட்டர் சேர்க்க"
  },
  overview: {
    en: "Dashboard Overview",
    si: "දළ විශ්ලේෂණය",
    ta: "கண்ணோட்டம்"
  }
};

/**
 * Detect applicable action buttons
 *
 * @param {string} userMessage - User's query
 * @param {string} botReply - Bot's response
 * @param {object} userContext - Live user context
 * @param {string} language - Target language ('en', 'si', 'ta')
 * @returns {Array<{ label: string, route: string, variant: string }>}
 */
function detectActions(userMessage, botReply, userContext, language = 'en') {
  const lang = (language === 'si' || language === 'ta') ? language : 'en';
  const actions = [];
  const combinedText = `${userMessage || ''} ${botReply || ''}`.toLowerCase();

  // If user has no meter linked
  if (!userContext?.hasMeters) {
    actions.push({
      label: ACTION_LABELS.addMeter[lang],
      route: "add-meter",
      variant: "primary"
    });
    return actions;
  }

  const primaryMeter = userContext.primaryMeter;
  const balance = primaryMeter ? primaryMeter.balance : 0;
  const isLowBalance = balance <= 100 || primaryMeter?.emergencyCreditActive;

  // 1. Payment / Recharge action
  const paymentKeywords = [
    'pay', 'recharge', 'topup', 'top-up', 'balance', 'credit', 'lifeline', 'money', 'empty',
    'රීචාර්ජ්', 'ගෙවීම්', 'ශේෂය', 'සල්ලි', 'ரீசார்ஜ்', 'செலுத்த', 'மீதி'
  ];
  if (paymentKeywords.some(kw => combinedText.includes(kw)) || isLowBalance) {
    actions.push({
      label: ACTION_LABELS.payments[lang],
      route: "payments",
      variant: isLowBalance ? "primary" : "secondary"
    });
  }

  // 2. Payment History action
  const historyKeywords = [
    'history', 'receipt', 'last payment', 'previous recharge', 'statement', 'transactions',
    'ඉතිහාසය', 'රිසිට්පත', 'පෙර ගෙවීම', 'வரலாறு', 'ரசீது', 'முந்தைய ரீசார்ஜ்'
  ];
  if (historyKeywords.some(kw => combinedText.includes(kw))) {
    actions.push({
      label: ACTION_LABELS.history[lang],
      route: "history",
      variant: "outline"
    });
  }

  // 3. Complaint / Outage / Support action
  const complaintKeywords = [
    'complaint', 'outage', 'power cut', 'breakdown', 'dispute', 'meter problem', 'error', 'defect',
    'hotline', 'repair', 'issue', 'පැමිණිලි', 'විදුලි බිඳවැටීම', 'දෝෂය', 'ගැටලුව', 'புகார்', 'மின்தடை', 'பிரச்சனை'
  ];
  if (complaintKeywords.some(kw => combinedText.includes(kw))) {
    actions.push({
      label: ACTION_LABELS.complaints[lang],
      route: "complaints",
      variant: "outline"
    });
  }

  // 4. Account Settings action
  const settingsKeywords = [
    'setting', 'profile', 'password', 'phone', 'email', 'alert', 'notification', 'language',
    'සැකසුම්', 'මුරපදය', 'දැනුම්දීම්', 'அமைப்புகள்', 'கடவுச்சொல்', 'அறிவிப்பு'
  ];
  if (settingsKeywords.some(kw => combinedText.includes(kw))) {
    actions.push({
      label: ACTION_LABELS.settings[lang],
      route: "settings",
      variant: "outline"
    });
  }

  // Cap at maximum 2 actions to keep chat uncluttered
  return actions.slice(0, 2);
}

module.exports = {
  detectActions,
  ACTION_LABELS
};
