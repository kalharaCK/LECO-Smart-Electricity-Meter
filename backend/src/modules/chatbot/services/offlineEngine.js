/**
 * Intelligent Offline Rule & Context Engine (Zero External API Dependency)
 * Provides high-fidelity, accurate answers when Groq API is unavailable,
 * unconfigured, or hits rate limits (HTTP 429).
 * Fully tri-lingual: English (en), Sinhala (si), and Tamil (ta).
 */

const { stripEmojis } = require('../security/promptGuard');

/**
 * Generate local response based on live user context and query intent
 *
 * @param {string} userMessage - User query
 * @param {object} userContext - Live context gathered from database
 * @param {string} language - Target language ('en', 'si', 'ta')
 * @returns {string} Fully localized response without emojis
 */
function generateOfflineReply(userMessage, userContext, language = 'en') {
  const lang = (language === 'si' || language === 'ta') ? language : 'en';
  const query = (userMessage || '').toLowerCase();

  // If user has no meters linked
  if (!userContext?.hasMeters || !userContext?.primaryMeter) {
    if (lang === 'si') {
      return "ඔබගේ ගිණුමට තවමත් ස්මාර්ට් මීටරයක් සම්බන්ධ කර නොමැත. බලශක්ති සහයක දත්ත ලබා ගැනීමට කරුණාකර 'මීටරයක් එක් කරන්න' (Add Meter) අංශය වෙත පිවිසෙන්න.";
    }
    if (lang === 'ta') {
      return "உங்கள் கணக்கில் இன்னும் ஸ்மார்ட் மீட்டர் இணைக்கப்படவில்லை. ஆற்றல் உதவியாளர் தகவல்களைப் பெற தயவுசெய்து 'மீட்டர் சேர்க்க' பகுதிக்குச் செல்லவும்.";
    }
    return "You do not have any smart meters connected to your account yet. Please add a meter in the 'Add Meter' section to enable energy assistant insights.";
  }

  const meter = userContext.primaryMeter;
  const pred = userContext.prediction || {};
  const trend = userContext.weeklyTrend;
  const lastPay = userContext.recentPayments?.[0];
  const tou = userContext.currentTOU;

  // 1. Prediction / Days Remaining Query
  const isDaysQuery = query.includes('how many days') || query.includes('days left') || query.includes('days remaining') ||
    query.includes('how long') || query.includes('prediction') || query.includes('දින') || query.includes('දවස්') ||
    query.includes('நாட்கள்') || query.includes('எவ்வளவு நாள்');

  if (isDaysQuery) {
    const balanceStr = meter.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const daysStr = pred.estimatedDaysRemaining ?? "N/A";
    const burnStr = pred.averageDailyUsageKwh ?? "N/A";
    const tierStr = pred.currentTariffGroup || "Domestic Block";
    const minDays = pred.estimatedMinDays ?? daysStr;
    const maxDays = pred.estimatedMaxDays ?? daysStr;

    if (pred.isLifelineActive && meter.balance < 0) {
      const remainingBuffer = (pred.lifelineRemaining || 0).toFixed(2);
      if (lang === 'si') {
        return `[හදිසි ණය ක්‍රියාත්මකයි] ඔබගේ මීටරය රු. ${balanceStr} ශේෂයක් සහිතව හදිසි ණය (Lifeline Mode) මඟින් ක්‍රියාත්මක වේ. ඉතිරි ආරක්‍ෂිත සීමාව: රු. ${remainingBuffer} (දිනකට සාමාන්‍ය භාවිතය ${burnStr} kWh අනුව තව දින ~${daysStr}). රු. 500 සීමාව ඉක්මවන තුරු විදුලිය විසන්ධි නොවේ.`;
      }
      if (lang === 'ta') {
        return `[அவசர கடன் செயலில் உள்ளது] உங்கள் மீட்டர் ரூ. ${balanceStr} இருப்பில் அவசர கடன் பாதுகாப்பு முறையில் (Lifeline Mode) இயங்குகிறது. மீதமுள்ள அவசர கடன்: ரூ. ${remainingBuffer} (தினசரி ${burnStr} kWh வீதத்தில் சுமார் ~${daysStr} நாட்கள்). ரூ. 500 எல்லை முடியும் வரை மின்சாரம் துண்டிக்கப்படாது.`;
      }
      return `[LIFELINE MODE ACTIVE] Your meter is operating with Emergency Credit at a balance of Rs. ${balanceStr}. Buffer remaining: Rs. ${remainingBuffer} (~${daysStr} days at ${burnStr} kWh/day). Power will stay connected until the Rs. 500 buffer is exhausted.`;
    }

    if (lang === 'si') {
      return `ඔබගේ පවතින රු. ${balanceStr} ශේෂය සහ PUCSL ${tierStr} යටතේ දිනකට සාමාන්‍ය භාවිතය වන ${burnStr} kWh අනුපාතය අනුව, ඔබගේ විදුලි බලය තව දින ~${daysStr}ක් පමණ ප්‍රමාණවත් වේ (දින ${minDays}-${maxDays} අතර).`;
    }
    if (lang === 'ta') {
      return `உங்கள் தற்போதைய இருப்புத்தொகை ரூ. ${balanceStr} மற்றும் PUCSL ${tierStr} இன் கீழ் சராசரி தினசரி நுகர்வு ${burnStr} kWh அடிப்படையில், உங்கள் மின்சாரம் மேலும் சுமார் ~${daysStr} நாட்களுக்கு போதுமானது (எல்லை: ${minDays}-${maxDays} நாட்கள்).`;
    }
    return `Based on your available balance of Rs. ${balanceStr} and average burn rate of ${burnStr} kWh/day under PUCSL ${tierStr}, you have approximately ${daysStr} days of power remaining (range: ${minDays}-${maxDays} days).`;
  }

  // 2. Recharge / Last Payment Query
  const isPaymentQuery = query.includes('topup') || query.includes('top-up') || query.includes('recharge') ||
    query.includes('last payment') || query.includes('previous payment') || query.includes('ගෙවීම්') ||
    query.includes('රීචාර්ජ්') || query.includes('கட்டணம்') || query.includes('ரீசார்ஜ்');

  if (isPaymentQuery) {
    if (!lastPay) {
      if (lang === 'si') return "ඔබගේ ගිණුම සඳහා තවමත් රීචාර්ජ් ගෙවීම් වාර්තා වී නොමැත. 'ගෙවීම්' (Payments) අංශයෙන් ඔබට ඕනෑම වේලාවක රීචාර්ජ් කළ හැක.";
      if (lang === 'ta') return "உங்கள் கணக்கில் இதுவரை ரீசார்ஜ் எதுவும் பதிவு செய்யப்படவில்லை. டாஷ்போர்டில் உள்ள 'Payments' பொத்தானைப் பயன்படுத்தி நீங்கள் ரீசார்ஜ் செய்யலாம்.";
      return "You have not made any recharge payments yet. You can top up your balance anytime using the 'Recharge Balance' button on your dashboard.";
    }

    const payAmt = lastPay.amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (lang === 'si') {
      return `ඔබගේ අවසාන රීචාර්ජ් කිරීම රු. ${payAmt} වූ අතර එය ${lastPay.date} දින ${lastPay.method.toUpperCase()} මඟින් සිදු කර ඇත (අංකය: ${lastPay.transactionId}). ඔබගේ ශේෂය රු. ${lastPay.previousBalance.toFixed(2)} සිට රු. ${lastPay.newBalance.toFixed(2)} දක්වා යාවත්කාලීන විය.`;
    }
    if (lang === 'ta') {
      return `உங்கள் கடைசி ரீசார்ஜ் ரூ. ${payAmt} ஆகும். இது ${lastPay.date} அன்று ${lastPay.method.toUpperCase()} மூலம் செலுத்தப்பட்டது (குறிப்பு: ${lastPay.transactionId}). உங்கள் இருப்பு ரூ. ${lastPay.previousBalance.toFixed(2)} இலிருந்து ரூ. ${lastPay.newBalance.toFixed(2)} ஆக புதுப்பிக்கப்பட்டது.`;
    }
    return `Your last recharge was for Rs. ${payAmt} via ${lastPay.method.toUpperCase()} on ${lastPay.date} (Ref: ${lastPay.transactionId}). Your balance updated from Rs. ${lastPay.previousBalance.toFixed(2)} to Rs. ${lastPay.newBalance.toFixed(2)}.`;
  }

  // 3. Weekly Usage Comparison Query
  const isWeeklyQuery = query.includes('weekly') || query.includes('compare') || query.includes('consumption') ||
    query.includes('usage') || query.includes('පරිභෝජනය') || query.includes('සතිය') ||
    query.includes('நுகர்வு') || query.includes('வாரம்');

  if (isWeeklyQuery && trend) {
    if (lang === 'si') {
      if (trend.trend === 'increased') {
        return `පසුගිය දින 7 තුළ ඔබගේ ශුද්ධ විදුලි පරිභෝජනය ${trend.thisWeekNetKwh} kWh විය. මෙය පෙර සතියට (${trend.lastWeekNetKwh} kWh) සාපේක්ෂව ${trend.percentageChange}% ක (+${trend.differenceKwh} kWh) වැඩිවීමකි.`;
      } else if (trend.trend === 'decreased') {
        return `පසුගිය දින 7 තුළ ඔබගේ ශුද්ධ විදුලි භාවිතය ${trend.thisWeekNetKwh} kWh වූ අතර, එය පෙර සතියට (${trend.lastWeekNetKwh} kWh) වඩා ${trend.percentageChange}% ක (-${trend.differenceKwh} kWh) අඩුවීමකි. විශිෂ්ට බලශක්ති සංරක්ෂණයක්!`;
      }
      return `පසුගිය දින 7 තුළ ඔබගේ ශුද්ධ විදුලි පරිභෝජනය ${trend.thisWeekNetKwh} kWh වූ අතර, එය පෙර සතියට (${trend.lastWeekNetKwh} kWh) සමාන මට්ටමක පවතී.`;
    }

    if (lang === 'ta') {
      if (trend.trend === 'increased') {
        return `கடந்த 7 நாட்களில் உங்கள் நிகர மின்சார நுகர்வு ${trend.thisWeekNetKwh} kWh ஆகும். இது முந்தைய வாரத்தை (${trend.lastWeekNetKwh} kWh) விட ${trend.percentageChange}% (+${trend.differenceKwh} kWh) அதிகமாகும்.`;
      } else if (trend.trend === 'decreased') {
        return `கடந்த 7 நாட்களில் உங்கள் நிகர மின்சார நுகர்வு ${trend.thisWeekNetKwh} kWh ஆகும். இது முந்தைய வாரத்தை விட ${trend.percentageChange}% (-${trend.differenceKwh} kWh) குறைவாகும். சிறந்த மின்சார சேமிப்பு!`;
      }
      return `கடந்த 7 நாட்களில் உங்கள் நிகர மின்சார பயன்பாடு ${trend.thisWeekNetKwh} kWh ஆக முந்தைய வாரத்துடன் (${trend.lastWeekNetKwh} kWh) சீராக உள்ளது.`;
    }

    if (trend.trend === 'increased') {
      return `Over the last 7 days, your net electricity consumption was ${trend.thisWeekNetKwh} kWh. This is an increase of ${trend.percentageChange}% (+${trend.differenceKwh} kWh) compared to the previous week (${trend.lastWeekNetKwh} kWh).`;
    } else if (trend.trend === 'decreased') {
      return `In the last 7 days, your net usage was ${trend.thisWeekNetKwh} kWh, which is a decrease of ${trend.percentageChange}% (-${trend.differenceKwh} kWh) compared to the previous week (${trend.lastWeekNetKwh} kWh). Excellent energy conservation!`;
    }
    return `Your net electricity consumption over the last 7 days was ${trend.thisWeekNetKwh} kWh, consistent with the previous week (${trend.lastWeekNetKwh} kWh).`;
  }

  // 4. Balance & Status Query
  const isBalanceQuery = query.includes('balance') || query.includes('status') || query.includes('lifeline') ||
    query.includes('credit') || query.includes('ශේෂය') || query.includes('තත්ත්වය') ||
    query.includes('இருப்பு') || query.includes('நிலை');

  if (isBalanceQuery) {
    const balStr = meter.balance.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (lang === 'si') {
      let msg = `ඔබගේ වත්මන් පෙරගෙවුම් ශේෂය රු. ${balStr} වන අතර මීටර තත්ත්වය: ${meter.status} වේ.`;
      if (meter.emergencyCreditActive) {
        msg += `\n\n[හදිසි ණය ක්‍රියාත්මකයි] හදිසි ණය සීමාව -රු. ${meter.emergencyCreditLimit.toFixed(2)} දක්වා විදුලිය ලබා දේ. ඊළඟ රීචාර්ජ් කිරීමේදී මෙම මුදල ස්වයංක්‍රීයව පියවනු ලැබේ.`;
      } else if (meter.balance <= 100) {
        msg += `\n\n[දැනුම්දීම] ඔබගේ ශේෂය අඩු මට්ටමක පවතී (<= රු. 100). විසන්ධිවීම් වලක්වා ගැනීමට රු. 500 හදිසි ණය (Lifeline) ලබා ගැනීමට ඔබ සුදුසුකම් ලබයි.`;
      }
      return msg;
    }

    if (lang === 'ta') {
      let msg = `உங்கள் தற்போதைய முன்பண இருப்பு ரூ. ${balStr} மற்றும் மீட்டர் நிலை: ${meter.status} ஆகும்.`;
      if (meter.emergencyCreditActive) {
        msg += `\n\n[அவசர கடன் செயலில் உள்ளது] அவசர கடன் -ரூ. ${meter.emergencyCreditLimit.toFixed(2)} வரை மின்சாரத்தை வழங்குகிறது. அடுத்த ரீசார்ஜின் போது இது கழிக்கப்படும்.`;
      } else if (meter.balance <= 100) {
        msg += `\n\n[அறிவிப்பு] உங்கள் இருப்பு குறைவாக உள்ளது (<= ரூ. 100). துண்டிப்பைத் தடுக்க ரூ. 500 வரை அவசர கடனைப் பெற நீங்கள் தகுதியுடையவர்.`;
      }
      return msg;
    }

    let msg = `Your current prepaid balance is Rs. ${balStr} and meter connection status is ${meter.status}.`;
    if (meter.emergencyCreditActive) {
      msg += `\n\n[LIFELINE ACTIVE] Lifeline Mode is currently active up to -Rs. ${meter.emergencyCreditLimit.toFixed(2)}. Overdraft will be settled automatically on your next top-up.`;
    } else if (meter.balance <= 100) {
      msg += `\n\n[NOTICE] Your balance is low (<= Rs. 100). You are eligible to activate Emergency Credit (Lifeline Mode) up to Rs. 500 to prevent overnight disconnections.`;
    }
    return msg;
  }

  // 5. Peak Hours / TOU Query
  const isPeakQuery = query.includes('peak') || query.includes('hours') || query.includes('time of use') ||
    query.includes('tou') || query.includes('උච්ච') || query.includes('කාලය') ||
    query.includes('உச்ச') || query.includes('நேரம்');

  if (isPeakQuery) {
    if (lang === 'si') {
      return `LECO දෛනික කාල-භාවිත (TOU) කාලසටහන:\n- උච්ච වේලාවන් (Peak Hours): 18:30 සිට 22:30 දක්වා (රු. 54.00/kWh). කරුණාකර මෙම කාලය තුළ ඉස්ත්‍රික්ක, වතුර මෝටර්, හීටර් ක්‍රියාත්මක කිරීමෙන් වළකින්න.\n- දිවා වේලාවන් (Day Hours): 05:30 සිට 18:30 දක්වා (රු. 25.00/kWh).\n- අවම වේලාවන් (Off-Peak Hours): 22:30 සිට 05:30 දක්වා (රු. 13.00/kWh - අඩුම ගාස්තුව). රෙදි සේදීම සහ EV ආරෝපණය සඳහා වඩාත් සුදුසුය.\n\nවත්මන් තත්ත්වය: ${tou.name} (${tou.window})`;
    }
    if (lang === 'ta') {
      return `LECO தினசரி மின்சார பயன்பாட்டு அட்டவணை (TOU):\n- உச்ச நேரம் (Peak Hours): 18:30 முதல் 22:30 வரை (ரூ. 54.00/kWh). இரும்புப்பெட்டி, வாட்டர் மோட்டார் போன்றவற்றை இந்த நேரத்தில் தவிர்க்கவும்.\n- பகல் நேரம் (Day Hours): 05:30 முதல் 18:30 வரை (ரூ. 25.00/kWh).\n- குறைந்த நேரம் (Off-Peak Hours): 22:30 முதல் 05:30 வரை (ரூ. 13.00/kWh - மிகக் குறைந்த கட்டணம்).\n\nதற்போதைய நிலை: ${tou.name} (${tou.window})`;
    }
    return `LECO Time-of-Use (TOU) Electricity Schedule:\n- Peak Hours: 18:30 to 22:30 (Rs. 54.00/kWh). Please avoid high-load appliances like irons, water pumps, water heaters, and EV chargers during this window.\n- Day Hours: 05:30 to 18:30 (Rs. 25.00/kWh - Standard).\n- Off-Peak Hours: 22:30 to 05:30 (Rs. 13.00/kWh - Lowest rate). Best time for water pumping, washing machines, and EV charging.\n\nRight now: ${tou.name} (${tou.window})`;
  }

  // 6. Complaints & Breakdown Support Query
  const isHelpQuery = query.includes('complaint') || query.includes('outage') || query.includes('hotline') ||
    query.includes('1987') || query.includes('support') || query.includes('breakdown') ||
    query.includes('පැමිණිලි') || query.includes('ඇනහිටීම්') || query.includes('புகார்') || query.includes('மின்தடை');

  if (isHelpQuery) {
    if (lang === 'si') {
      return "විදුලි බිඳවැටීම් හෝ හදිසි අනතුරු සඳහා LECO 24/7 හදිසි ඇමතුම් අංකය: 1987 (නොමිලේ).\nබිල්පත් ගැටලු හෝ මීටර් පරීක්ෂා කිරීම් සඳහා ඔබගේ ඩෑෂ්බෝඩ් එකේ 'පැමිණිලි සහ සහාය' (Complaints) අංශය හරහා ටිකට් පතක් ඉදිරිපත් කළ හැක.";
    }
    if (lang === 'ta') {
      return "மின்சார தடைகள் அல்லது அவசர உதவிக்கு LECO 24/7 இலவச அவசர உதவி எண்: 1987.\nகட்டண முரண்பாடுகள் அல்லது மீட்டர் பழுதுகளுக்கு உங்கள் டாஷ்போர்டில் உள்ள 'Complaints & Support' பகுதி மூலம் புகார் பதிவு செய்யலாம்.";
    }
    return "For urgent power outages, line breakdowns, or hazards, call the LECO 24/7 Emergency Hotline: 1987 (toll-free across Sri Lanka).\nFor billing disputes or meter inspection requests, file a ticket directly via the 'Complaints & Support' tab on your dashboard.";
  }

  // 7. General Off-Topic Handling
  const isOffTopic = query.includes('weather') || query.includes('recipe') || query.includes('movie') ||
    query.includes('joke') || query.includes('කාලගුණය') || query.includes('வானிலை');

  if (isOffTopic) {
    if (lang === 'si') {
      return "මම LECO ස්මාර්ට් බලශක්ති සහයකයා වෙමි. මම විදුලි පරිභෝජනය, පෙරගෙවුම් ස්මාර්ට් මීටර් කළමනාකරණය, ගාස්තු සහ රීචාර්ජ් ඉතිහාසය පිළිබඳ විශේෂඥයෙක්මි. ඔබගේ විදුලි සැපයුම සම්බන්ධයෙන් මට ඔබට උපකාර කළ හැක්කේ කෙසේද?";
    }
    if (lang === 'ta') {
      return "நான் LECO ஸ்மார்ட் மின்சார உதவியாளர். நான் மின்சார பயன்பாடு, முன்கூட்டியே செலுத்தும் ஸ்மார்ட் மீட்டர், கட்டணங்கள் மற்றும் ரீசார்ஜ் வரலாறு ஆகியவற்றில் நிபுணத்துவம் பெற்றுள்ளேன். உங்கள் மின்சார கணக்கு குறித்து நான் எவ்வாறு உதவ முடியும்?";
    }
    return "I am the LECO Smart Energy Assistant. I specialize in electricity consumption, prepaid smart meter management, tariffs, and recharge history. How can I help with your power supply?";
  }

  // 8. General Greeting / Fallback
  if (lang === 'si') {
    return "ආයුබෝවන්! මම ඔබගේ LECO ස්මාර්ට් බලශක්ති සහයකයා වෙමි. මට ඔබට උපකාර කළ හැක්කේ:\n- ශේෂය තව දින කීයක් පවතීදැයි බැලීම (දින කීයක් ඉතිරිද?)\n- ඔබගේ අවසන් රීචාර්ජ් විස්තර බැලීම (අවසාන ගෙවීම කුමක්ද?)\n- සතිපතා විදුලි භාවිතය සැසඳීම (සතිපතා භාවිතය)\n- ශේෂය සහ Lifeline හදිසි ණය පරීක්ෂා කිරීම\n\nඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?";
  }
  if (lang === 'ta') {
    return "வணக்கம்! நான் உங்கள் LECO ஸ்மார்ட் மின்சார உதவியாளர். நான் உங்களுக்கு உதவக்கூடியவை:\n- உங்கள் இருப்பு எத்தனை நாட்கள் நீடிக்கும் என அறிதல் (மீதமுள்ள நாட்கள் எத்தனை?)\n- உங்கள் கடைசி ரீசார்ஜ் விவரங்களை சரிபார்த்தல் (கடைசி கட்டணம் என்ன?)\n- வாராந்திர மின்சார பயன்பாட்டை ஒப்பிடுதல்\n- உங்கள் இருப்பு மற்றும் அவசர கடன் நிலையை சரிபார்த்தல்\n\nநீங்கள் எதை அறிய விரும்புகிறீர்கள்?";
  }

  return "Hello! I am your LECO Smart Energy Assistant. I can help you with:\n- Estimating how many days your balance will last (How many days left?)\n- Reviewing your latest recharge (What was my last top-up?)\n- Comparing your weekly electricity usage (Compare weekly usage)\n- Checking your balance and Lifeline Emergency Credit status\n\nWhat would you like to know?";
}

module.exports = {
  generateOfflineReply
};
