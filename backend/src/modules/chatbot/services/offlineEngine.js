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
    query.includes('රීචාර්ජ්') || query.includes('கடைசி கட்டணம்') || query.includes('செலுத்து') || query.includes('ரீசார்ஜ்');

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

  // 6. Energy Saving Tips & Suggestions Query
  const isTipsQuery = query.includes('tip') || query.includes('suggest') || query.includes('save') ||
    query.includes('saving') || query.includes('reduce') || query.includes('conservation') ||
    query.includes('efficient') || query.includes('efficiency') ||
    query.includes('උපදෙස්') || query.includes('ඉතිරි') || query.includes('අඩු කර') ||
    query.includes('ஆலோசனை') || query.includes('சேமிக்க') || query.includes('குறைக்க');

  if (isTipsQuery) {
    const dailyKwh = pred.averageDailyUsageKwh ?? "2.5";
    const cycleNet = userContext.cycleUsage?.netKwh ?? "0";
    const tier = pred.currentTariffGroup || "Domestic Block";
    const trendTextEn = trend
      ? (trend.trend === 'increased'
          ? `Your net usage increased by ${trend.percentageChange}% (+${trend.differenceKwh} kWh) over the last 7 days.`
          : trend.trend === 'decreased'
          ? `Your net usage decreased by ${trend.percentageChange}% (-${trend.differenceKwh} kWh) over the last 7 days. Great conservation!`
          : `Your weekly usage is steady at ${trend.thisWeekNetKwh} kWh.`)
      : `Your average burn rate is ${dailyKwh} kWh/day.`;

    if (lang === 'si') {
      const trendTextSi = trend
        ? (trend.trend === 'increased'
            ? `පසුගිය දින 7 තුළ ඔබගේ භාවිතය ${trend.percentageChange}% කින් (+${trend.differenceKwh} kWh) වැඩි වී ඇත.`
            : trend.trend === 'decreased'
            ? `පසුගිය දින 7 තුළ ඔබගේ භාවිතය ${trend.percentageChange}% කින් (-${trend.differenceKwh} kWh) අඩු වී ඇත. විශිෂ්ටයි!`
            : `ඔබගේ සතිපතා භාවිතය ස්ථාවරව ${trend.thisWeekNetKwh} kWh මට්ටමේ පවතී.`)
        : `ඔබගේ දෛනික සාමාන්‍ය භාවිතය ${dailyKwh} kWh වේ.`;

      return `[ඔබට ගැලපෙන බලශක්ති ඉතිරි කිරීමේ සැලැස්ම]\n\nඔබගේ දත්ත: දෛනික භාවිතය ~${dailyKwh} kWh/day, මාසික එකතුව ${cycleNet} kWh (${tier} යටතේ).\n${trendTextSi}\n\n1. උච්ච වේලාවන් (Peak Hours) මඟහැරීම:\nසවස 18:30 සිට 22:30 දක්වා කාලයේ විදුලි ඒකකයක් රු. 54.00 කි. රාත්‍රී 22:30 න් පසු (Off-Peak) ඒකකයක් රු. 13.00 ක් පමණි. වතුර මෝටර්, රෙදි සේදීමේ යන්ත්‍ර සහ ඉස්ත්‍රික්කය රාත්‍රී 22:30 න් පසු භාවිතයෙන් ඒකකයකට 75% කට වඩා ඉතිරි කරගත හැක.\n\n2. PUCSL ගාස්තු කාණ්ඩය ආරක්ෂා කර ගැනීම:\nමසකට ඒකක 60 සීමාව ඉක්මවුවහොත් සහනාධාර අහිමි වී ඉහළ ස්ථාවර ගාස්තු සහ ඒකක ගාස්තු අයවේ. දෛනික භාවිතය උපරිම 2.0 kWh මට්ටමේ තබා ගන්න.\n\n3. උපකරණ කාර්යක්ෂමතාව:\n- වායුසමන (AC) උෂ්ණත්වය 25°C-26°C මට්ටමේ තබන්න (සෑම අංශකයකටම 6% ක් ඉතිරි වේ).\n- නිවසේ සියලු විදුලි බුබුළු සඳහා LED බල්බ භාවිතා කරන්න (80% ක් ඉතිරි වේ).\n- ශීතකරණයේ දොර මුද්‍රා නිසි පරිදි පරීක්ෂා කර උණුසුම් ආහාර ශීතකරණයට දැමීමෙන් වළකින්න.`;
    }

    if (lang === 'ta') {
      const trendTextTa = trend
        ? (trend.trend === 'increased'
            ? `கடந்த 7 நாட்களில் உங்கள் பயன்பாடு ${trend.percentageChange}% (+${trend.differenceKwh} kWh) அதிகரித்துள்ளது.`
            : trend.trend === 'decreased'
            ? `கடந்த 7 நாட்களில் உங்கள் பயன்பாடு ${trend.percentageChange}% (-${trend.differenceKwh} kWh) குறைந்துள்ளது. சிறந்த சேமிப்பு!`
            : `உங்கள் வாராந்திர நுகர்வு ${trend.thisWeekNetKwh} kWh ஆக சீராக உள்ளது.`)
        : `உங்கள் தினசரி சராசரி நுகர்வு ${dailyKwh} kWh ஆகும்.`;

      return `[தனிப்பயனாக்கப்பட்ட மின்சார சேமிப்பு திட்டம்]\n\nஉங்கள் நேரடி தரவு: தினசரி நுகர்வு ~${dailyKwh} kWh/நாள், மாத நுகர்வு ${cycleNet} kWh (${tier} இன் கீழ்).\n${trendTextTa}\n\n1. உச்ச நேர பயன்பாட்டை தவிர்த்தல் (Peak Hours Shifting):\nமாலை 18:30 முதல் 22:30 வரை ஒரு அலகுக்கு ரூ. 54.00 கட்டணம். இரவு 22:30 க்கு பிறகு (Off-Peak) ரூ. 13.00 மட்டுமே. தண்ணீர் மோட்டார், சலவை இயந்திரம், இரும்புப்பெட்டி போன்றவற்றை இரவு 22:30 க்குப் பிறகு பயன்படுத்தினால் 75% வரை சேமிக்கலாம்.\n\n2. PUCSL கட்டண அடுக்கை பராமரித்தல்:\nமாத நுகர்வு 60 kWh ஐ தாண்டினால் அரசாங்க மானியம் இழக்கப்பட்டு கூடுதல் கட்டணங்கள் விதிக்கப்படும். தினசரி நுகர்வை 2.0 kWh க்குள் வைத்திருக்க முயலுங்கள்.\n\n3. வீட்டு உபகரண மேலாண்மை:\n- ஏர் கண்டிஷனரை 25°C-26°C இல் இயக்கவும் (ஒவ்வொரு பாகைக்கும் 6% மின்சாரம் சேமிக்கப்படும்).\n- அனைத்து விளக்குகளுக்கும் LED பல்புகளை பயன்படுத்தவும் (80% வரை சேமிப்பு).\n- குளிர்சாதன பெட்டியில் சூடான உணவுகளை வைப்பதை தவிர்க்கவும்.`;
    }

    return `[CUSTOMIZED ENERGY SAVING PLAN]\n\nYour Live Telemetry: Average burn rate ~${dailyKwh} kWh/day, monthly cumulative ${cycleNet} kWh under ${tier}.\n${trendTextEn}\n\n1. Time-of-Use Peak Shifting:\nPeak hours (18:30 to 22:30) cost Rs. 54.00/kWh, whereas off-peak hours (22:30 to 05:30) cost only Rs. 13.00/kWh. Shifting your water pump, washing machine, and electric iron to after 22:30 saves over 75% per unit on those loads.\n\n2. PUCSL Tariff Threshold Strategy:\nExceeding 60 kWh in a billing cycle transitions you out of subsidized lifeline blocks into higher unit rates and monthly fixed charges. Target keeping your daily consumption below 2.0 kWh to protect your lower tariff tier.\n\n3. High-Impact Appliance Habits:\n- Set inverter air conditioners to 25°C - 26°C (each degree lower increases consumption by ~6%).\n- Replace all conventional lighting with high-efficiency LED lamps to cut lighting load by up to 80%.\n- Check refrigerator door seals and avoid loading warm food directly into the fridge.`;
  }

  // 7. Why Is Bill High / Consumption Spike Query (Electricity Usage)
  const isUsageSpikeQuery = query.includes('spike') || query.includes('high bill') || query.includes('bill high') ||
    query.includes('why bill') || query.includes('consumption high') || query.includes('leakage') ||
    query.includes('more units') || query.includes('drain') || query.includes('වැඩිපුර') ||
    query.includes('බිල වැඩි') || query.includes('අධික බිල') || query.includes('අධික පරිභෝජනය') ||
    query.includes('அதிக கட்டணம்') || query.includes('அதிக நுகர்வு');

  if (isUsageSpikeQuery) {
    if (lang === 'si') {
      return `[අධික විදුලි බිල හෝ පරිභෝජනය ඉහළ යාමට හේතු පරීක්ෂාව]\n\n1. වතුර මෝටරයේ ස්වයංක්‍රීය ස්විචය (Float Switch) ඇලවීම:\nටැංකිය පිරී ගියද මෝටරය නොනවත්වා ක්‍රියාත්මක වීමෙන් දිනකට ඒකක 15-30ක් පමණ නිරපරාදේ වැය විය හැක.\n\n2. ශීතකරණයේ දොර රබර් පටිය (Door Gasket) බුරුල් වීම:\nසීතල පිටතට කාන්දු වන විට කොම්ප්‍රෙසරය පැය 24 පුරාම ක්‍රියාත්මක වේ.\n\n3. වායුසමන (AC) ෆිල්ටර් අපිරිසිදු වීම:\nඅපිරිසිදු ෆිල්ටර් නිසා විදුලි පරිභෝජනය 15% සිට 30% දක්වා වැඩිවේ.\n\n4. නිවසේ රැහැන් ඇදීමේ කාන්දුවීම් (Earth Leakage):\nනිවසේ සියලු ස්විච අක්‍රිය කර මීටරයේ රතු ස්පන්දන (Pulse) LED ආලෝකය තවමත් දැල්වෙන්නේ දැයි පරීක්ෂා කරන්න. එය දැල්වේ නම් රැහැන් කාන්දුවක් පැවතිය හැක. අවශ්‍ය නම් 'පැමිණිලි' (Complaints) අංශයෙන් පරීක්ෂණයක් ඉල්ලුම් කරන්න.`;
    }
    if (lang === 'ta') {
      return `[அதிக மின் கட்டணம் அல்லது திடீர் நுகர்வு அதிகரிப்புக்கான காரணங்கள்]\n\n1. தண்ணீர் மோட்டார் மிதவை சுவிட்ச் (Float Switch) பழுது:\nதண்ணீர் தொட்டி நிரம்பிய பிறகும் மோட்டார் தொடர்ந்து இயங்கினால் ஒரு நாளைக்கு 15-30 அலகுகள் வரை தேவையின்றி வீணாகலாம்.\n\n2. குளிர்சாதன பெட்டி கதவு கேஸ்கெட் (Door Gasket) சேதம்:\nகுளிர்ந்த காற்று வெளியேறும்போது அமுக்கி (Compressor) தொடர்ந்து 24 மணி நேரமும் இயங்கும்.\n\n3. ஏசி பில்டர்களில் தூசி அடைப்பு:\nதூசி அடைக்கப்பட்ட பில்டர்கள் மின்சார நுகர்வை 15% முதல் 30% வரை அதிகரிக்கும்.\n\n4. வீட்டின் வயரிங் மின் கசிவு (Earth Leakage):\nவீட்டிலுள்ள அனைத்து சாதனங்களையும் அணைத்துவிட்டு, மீட்டரில் உள்ள சிவப்பு பல்ஸ் எல்இடி ஒளிர்கிறதா என்று பார்க்கவும். அது தொடர்ந்து ஒளிர்ந்தால் மின் கசிவு இருக்கலாம். எங்கள் டாஷ்போர்டு மூலமாக பரிசோதனை கோரிக்கை விடுக்கலாம்.`;
    }
    return `[HIGH BILL & USAGE SPIKE INVESTIGATION]\n\n1. Water Pump Float Switch Malfunction:\nIf the overhead tank float switch sticks, the pump can run continuously undetected, consuming an extra 15 to 30 kWh per day.\n\n2. Refrigerator Door Gasket Leakage:\nA worn-out magnetic door seal allows cold air to escape, forcing the compressor to run 24/7 rather than cycling efficiently.\n\n3. Air Conditioner Filter Blockage:\nClogged dust filters restrict airflow, causing the AC compressor to work harder and increasing power draw by 15% to 30%.\n\n4. Internal Wiring Earth Leakage:\nTo test for electrical leakage, switch off all household appliances at the wall and observe if the smart meter's red pulse LED still flashes. If it blinks while everything is off, an electrician should inspect your wiring. You may also request a meter inspection under the 'Complaints' tab.`;
  }

  // 8. Rooftop Solar & Net Metering Query (Electricity Usage)
  const isSolarQuery = query.includes('solar') || query.includes('net metering') || query.includes('export') ||
    query.includes('solar units') || query.includes('rooftop') || query.includes('solar panels') ||
    query.includes('සූර්ය') || query.includes('සෝලා') || query.includes('අපනයනය') ||
    query.includes('சூரிய சக்தி') || query.includes('மின் ஏற்றுமதி');

  if (isSolarQuery) {
    const todayExp = userContext.todayUsage?.exportKwh ?? 0;
    const todayImp = userContext.todayUsage?.importKwh ?? 0;
    const todayNet = userContext.todayUsage?.netKwh ?? 0;

    if (lang === 'si') {
      return `[LECO සූර්ය බලශක්ති සහ ශුද්ධ මැනුම් (Net Metering) මාර්ගෝපදේශය]\n\nඅද දින දත්ත:\n- ජාලයෙන් ලබාගත් විදුලිය (Import): ${todayImp} kWh\n- සූර්ය පැනල මඟින් ජාලයට යැවූ විදුලිය (Export): ${todayExp} kWh\n- ශුද්ධ බිල්පත් පරිභෝජනය (Net): ${todayNet} kWh\n\nLECO ස්මාර්ට් මීටර මඟින් ජාලයෙන් ලබාගන්නා සහ ජාලයට ලබාදෙන විදුලිය වෙන වෙනම නිවැරදිව මනිනු ලැබේ. අතිරික්ත සූර්ය ඒකක ඊළඟ බිල්පත් චක්‍රයට බැර කෙරේ (Net Metering) හෝ CEB/LECO අනුමත ගාස්තුව යටතේ ගෙවනු ලැබේ (Net Accounting).`;
    }
    if (lang === 'ta') {
      return `[LECO சூரிய சக்தி மற்றும் நெட் மீட்டரிங் வழிகாட்டுதல்]\n\nஇன்றைய அளவீடு:\n- கிரிட்டிலிருந்து பெறப்பட்ட மின்சாரம் (Import): ${todayImp} kWh\n- சூரிய மின் உற்பத்தியில் கிரிட்டுக்கு அனுப்பப்பட்டது (Export): ${todayExp} kWh\n- நிகர பில் பயன்பாடு (Net): ${todayNet} kWh\n\nLECO ஸ்மார்ட் மீட்டர் இருவழி நுகர்வையும் துல்லியமாக பதிவு செய்கிறது. உபரி மின்சார அலகுகள் அடுத்த மாதத்திற்கு மாற்றப்படும் (Net Metering) அல்லது அங்கீகரிக்கப்பட்ட கட்டணத்தில் வாங்கப்படும் (Net Accounting).`;
    }
    return `[LECO ROOFTOP SOLAR & NET METERING GUIDE]\n\nToday's Solar Telemetry:\n- Grid Import: ${todayImp} kWh\n- Solar Export to Grid: ${todayExp} kWh\n- Billed Net Usage: ${todayNet} kWh (Import minus Export)\n\nLECO bi-directional smart meters track grid consumption and solar generation export on independent, high-precision registers. Under Net Metering, surplus exported units roll forward as energy credits. Under Net Accounting, surplus generation is credited at the official utility feed-in tariff.`;
  }

  // 9. Appliance Power Consumption & Wattage Query (Savings / Usage)
  const isApplianceQuery = query.includes('appliance') || query.includes('wattage') || query.includes('watts') ||
    query.includes('how much power') || query.includes('power draw') || query.includes('water heater') ||
    query.includes('water pump') || query.includes('iron') || query.includes('air conditioner') ||
    query.includes('fridge power') || query.includes('geyser') || query.includes('oven') ||
    query.includes('උපකරණ') || query.includes('වොට්') || query.includes('ශීතකරණය') ||
    query.includes('ඉස්ත්‍රික්කය') || query.includes('மின் உபகரணங்கள்') || query.includes('வாட்');

  if (isApplianceQuery) {
    if (lang === 'si') {
      return `[ප්‍රධාන ගෘහ විදුලි උපකරණවල සාමාන්‍ය විදුලි වැයවීම]:\n\n- Inverter වායුසමන (1.0 HP AC): පැයකට ~0.7 සිට 1.0 kWh (උෂ්ණත්වය 25°C-26°C තබන්න).\n- විදුලි ඉස්ත්‍රික්කය: පැයකට ~1.0 සිට 1.8 kWh. රෙදි එකවර විශාල තොගයක් ලෙස රාත්‍රී 22:30 න් පසු අයන් කරන්න.\n- වතුර මෝටරය (0.5 - 1.0 HP): පැයකට ~0.4 සිට 0.75 kWh. අඩු ගාස්තු සහිත Off-Peak වේලාවේ ක්‍රියාත්මක කරන්න.\n- වතුර හීටරය / Geyser: පැයකට ~2.0 සිට 3.0 kWh.\n- ශීතකරණය (Inverter): පැය 24 කට ~0.8 සිට 1.5 kWh පමණි.\n- LED බල්බ: 7W - 12W (පැරණි බල්බ වලට වඩා 85% ක ඉතිරියක්).`;
    }
    if (lang === 'ta') {
      return `[பொதுவான வீட்டு உபகரணங்களின் மின்சார நுகர்வு விபரம்]:\n\n- இன்வெர்ட்டர் ஏசி (1.0 HP AC): ஒரு மணி நேரத்திற்கு ~0.7 முதல் 1.0 kWh (25°C-26°C இல் இயக்கவும்).\n- இரும்புப்பெட்டி: ஒரு மணி நேரத்திற்கு ~1.0 முதல் 1.8 kWh. இரவு 22:30 க்குப் பிறகு மொத்தமாக அயர்ன் செய்யவும்.\n- தண்ணீர் மோட்டார் (0.5 - 1.0 HP): ஒரு மணி நேரத்திற்கு ~0.4 முதல் 0.75 kWh. குறைந்த கட்டண நேரத்தில் இயக்கவும்.\n- வாட்டர் ஹீட்டர்: ஒரு மணி நேரத்திற்கு ~2.0 முதல் 3.0 kWh.\n- இன்வெர்ட்டர் குளிர்சாதன பெட்டி: 24 மணி நேரத்திற்கு ~0.8 முதல் 1.5 kWh மட்டுமே.\n- LED பல்புகள்: 7W - 12W (பழைய பல்புகளை விட 85% மின் சேமிப்பு).`;
    }
    return `[HOUSEHOLD APPLIANCE POWER CONSUMPTION GUIDE]:\n\n- Inverter AC (1.0 HP / 9000 BTU): ~0.7 to 1.0 kWh per hour when room is cooled. Keep at 25°C - 26°C.\n- Electric Iron: ~1.0 to 1.8 kWh per hour. Recommendation: Iron clothes in bulk during off-peak hours (after 22:30).\n- Overhead Water Pump (0.5 - 1.0 HP): ~0.4 to 0.75 kWh per hour. Run during off-peak window.\n- Water Heater / Shower Geyser: ~2.0 to 3.5 kWh per hour.\n- Inverter Refrigerator: ~0.8 to 1.5 kWh per 24 hours.\n- LED Lighting: 7W to 12W per bulb (saves 85% compared to old incandescent bulbs).`;
  }

  // 10. PUCSL Domestic Tariff Blocks Query (Savings / Tariffs)
  const isTariffQuery = query.includes('tariff') || query.includes('pucsl') || query.includes('slab') ||
    query.includes('block') || query.includes('rate') || query.includes('fixed charge') ||
    query.includes('unit cost') || query.includes('tariff rate') || query.includes('ගාස්තු') ||
    query.includes('ඒකකයක මිල') || query.includes('ස්ථාවර ගාස්තුව') || query.includes('கட்டணம்') || query.includes('அலகு விலை');

  if (isTariffQuery) {
    if (lang === 'si') {
      return `[ශ්‍රී ලංකා මහජන උපයෝගිතා කොමිෂන් සභාව (PUCSL) ගෘහස්ථ විදුලි ගාස්තු ක්‍රමය]:\n\n- කාණ්ඩය 1 (ඒකක 0 - 30): ඒකකයකට රු. 8.00 + මාසික ස්ථාවර ගාස්තුව රු. 150.00\n- කාණ්ඩය 2 (ඒකක 31 - 60): ඒකකයකට රු. 15.00 + මාසික ස්ථාවර ගාස්තුව රු. 300.00\n- කාණ්ඩය 3 (ඒකක 61 - 90): ඒකකයකට රු. 27.00 + මාසික ස්ථාවර ගාස්තුව රු. 400.00\n- කාණ්ඩය 4 (ඒකක 91 - 120): ඒකකයකට රු. 35.00 + මාසික ස්ථාවර ගාස්තුව රු. 1,000.00\n- කාණ්ඩය 5 (ඒකක 121 - 180): ඒකකයකට රු. 45.00 + මාසික ස්ථාවර ගාස්තුව රු. 1,500.00\n- කාණ්ඩය 6 (ඒකක 180 ට වැඩි): ඒකකයකට රු. 58.00 + මාසික ස්ථාවර ගාස්තුව රු. 2,000.00\n\nසටහන: ඒකක 60 ට අඩු පාරිභෝගිකයින්ට රජයේ සහනාධාර හිමිවේ. ඔබගේ වත්මන් කාණ්ඩය: ${pred.currentTariffGroup || "Domestic Block"}.`;
    }
    if (lang === 'ta') {
      return `[இலங்கை பொதுப் பயன்பாடுகள் ஆணைக்குழு (PUCSL) வீட்டு மின் கட்டண அடுக்குகள்]:\n\n- அடுக்கு 1 (0 - 30 kWh): ஒரு அலகுக்கு ரூ. 8.00 + மாத கட்டணம் ரூ. 150.00\n- அடுக்கு 2 (31 - 60 kWh): ஒரு அலகுக்கு ரூ. 15.00 + மாத கட்டணம் ரூ. 300.00\n- அடுக்கு 3 (61 - 90 kWh): ஒரு அலகுக்கு ரூ. 27.00 + மாத கட்டணம் ரூ. 400.00\n- அடுக்கு 4 (91 - 120 kWh): ஒரு அலகுக்கு ரூ. 35.00 + மாத கட்டணம் ரூ. 1,000.00\n- அடுக்கு 5 (121 - 180 kWh): ஒரு அலகுக்கு ரூ. 45.00 + மாத கட்டணம் ரூ. 1,500.00\n- அடுக்கு 6 (180 kWh க்கு மேல்): ஒரு அலகுக்கு ரூ. 58.00 + மாத கட்டணம் ரூ. 2,000.00\n\nகுறிப்பு: 60 அலகுகளுக்குள் பயன்படுத்தும் நுகர்வோருக்கு அரசு மானியம் கிடைக்கிறது. உங்கள் தற்போதைய அடுக்கு: ${pred.currentTariffGroup || "Domestic Block"}.`;
    }
    return `[PUCSL DOMESTIC ELECTRICITY TARIFF STRUCTURE]:\n\n- Block 1 (0 to 30 kWh): Rs. 8.00/kWh + Monthly Fixed Charge: Rs. 150.00\n- Block 2 (31 to 60 kWh): Rs. 15.00/kWh + Monthly Fixed Charge: Rs. 300.00\n- Block 3 (61 to 90 kWh): Rs. 27.00/kWh + Monthly Fixed Charge: Rs. 400.00\n- Block 4 (91 to 120 kWh): Rs. 35.00/kWh + Monthly Fixed Charge: Rs. 1,000.00\n- Block 5 (121 to 180 kWh): Rs. 45.00/kWh + Monthly Fixed Charge: Rs. 1,500.00\n- Block 6 (Above 180 kWh): Rs. 58.00/kWh + Monthly Fixed Charge: Rs. 2,000.00\n\nLifeline Subsidy: Consumption under 60 kWh/month receives government lifeline subsidies. Exceeding 60 kWh in a billing cycle transitions you into higher unsubsidized rates. Your current tier: ${pred.currentTariffGroup || "Domestic Block"}.`;
  }

  // 11. Disconnection & Automatic Reconnection Query (Account)
  const isReconnectionQuery = query.includes('reconnect') || query.includes('disconnect') || query.includes('relay') ||
    query.includes('power off') || query.includes('cut off') || query.includes('restore power') ||
    query.includes('overnight') || query.includes('22:00') || query.includes('විසන්ධි') ||
    query.includes('නැවත සම්බන්ධ') || query.includes('துண்டிப்பு') || query.includes('மீண்டும் இணைப்பு');

  if (isReconnectionQuery) {
    if (lang === 'si') {
      return `[ස්මාර්ට් මීටර් ස්වයංක්‍රීය විසන්ධිවීම් සහ නැවත සම්බන්ධ කිරීමේ ප්‍රතිපත්තිය]:\n\n1. හදිසි ණය (Lifeline): ශේෂය රු. 0.00 වූ වහාම විදුලිය විසන්ධි නොවේ. රු. 500 දක්වා හදිසි ණය ක්‍රියාත්මක වේ.\n2. රාත්‍රී විසන්ධි නොකිරීමේ ආරක්ෂාව: රාත්‍රී 22:00 සිට පසුදා උදෑසන 06:00 දක්වා කාලය තුළ කිසිදු හේතුවක් මත විදුලිය විසන්ධි නොකෙරේ.\n3. ස්වයංක්‍රීයව නැවත සම්බන්ධ වීම: විදුලිය විසන්ධි වුවහොත්, අවම වශයෙන් රු. 100 ක රීචාර්ජ් කිරීමක් සිදු කළ පසු තත්පර 10 සිට 30 දක්වා කාලය තුළ ස්වයංක්‍රීයව විදුලිය නැවත ක්‍රියාත්මක වේ. කාර්මික ශිල්පියෙකු පැමිණීම හෝ නැවත සම්බන්ධ කිරීමේ ගාස්තුවක් අවශ්‍ය නොවේ.`;
    }
    if (lang === 'ta') {
      return `[ஸ்மார்ட் மீட்டர் துண்டிப்பு மற்றும் உடனடி மறுஇணைப்பு விதிகள்]:\n\n1. அவசர கடன் (Lifeline): இருப்பு ரூ. 0.00 ஐ எட்டும்போது உடனடியாக மின்சாரம் துண்டிக்கப்படாது. ரூ. 500 வரை அவசர கடன் இயங்கும்.\n2. இரவு நேர பாதுகாப்பு: நுகர்வோர் பாதுகாப்பு விதிகளின்படி இரவு 22:00 முதல் காலை 06:00 மணி வரை மின்சாரம் துண்டிக்கப்படாது.\n3. உடனடி மறுஇணைப்பு: துண்டிக்கப்பட்ட பிறகு குறைந்தபட்சம் ரூ. 100 ரீசார்ஜ் செய்தால் 10 முதல் 30 வினாடிகளுக்குள் தானாகவே மின்சாரம் மீட்டமைக்கப்படும். தொழில்நுட்ப வல்லுநர் வருகை அல்லது மறுஇணைப்பு கட்டணம் தேவையில்லை.`;
    }
    return `[SMART METER REMOTE DISCONNECTION & RECONNECTION POLICY]:\n\n1. Lifeline Protection: When your prepaid balance reaches Rs. 0.00, power is not immediately disconnected. The smart meter activates Emergency Credit (Lifeline) up to -Rs. 500.00.\n2. Overnight Immunity Window: Electricity is strictly NEVER disconnected between 22:00 (10:00 PM) and 06:00 (6:00 AM) due to low balance.\n3. Instant Automatic Reconnection: If power is disconnected, recharging your account with at least Rs. 100 will cause the AMI cellular network to close the meter relay automatically within 10 to 30 seconds. No technician visit or reconnection fee is required.`;
  }

  // 12. Account Management, Multi-Meter & PIN Query (Account)
  const isAccountQuery = (query.includes('meter') && (query.includes('link') || query.includes('add') || query.includes('connect') || query.includes('multi') || query.includes('another'))) ||
    query.includes('add meter') || query.includes('link meter') || query.includes('account') || query.includes('pin') ||
    query.includes('sms') || query.includes('alert') || query.includes('budget') || query.includes('password') ||
    query.includes('phone number') || query.includes('profile') ||
    query.includes('මීටරය එක් කරන්න') || query.includes('නව මීටර්') || query.includes('මුරපදය') ||
    query.includes('දුරකථන අංකය') || query.includes('ගිණුම') || query.includes('மீட்டர் சேர்க்க') ||
    query.includes('புதிய மீட்டர்') || query.includes('கடவுச்சொல்') || query.includes('கணக்கு');

  if (isAccountQuery) {
    if (lang === 'si') {
      return `[ගිණුම් සහ ස්මාර්ට් මීටර් කළමනාකරණය]:\n\n1. නව මීටරයක් එක් කිරීම: ඔබගේ නිවස, ව්‍යාපාරය හෝ කුලී නිවාස සඳහා වෙනත් මීටර් සම්බන්ධ කිරීමට 'මීටරය එක් කරන්න' (Add Meter) අංශයට ගොස් ඉලක්කම් 9 කින් යුත් මීටර් අංකය සහ ලෙකෝ රහස්‍ය PIN අංකය ඇතුළත් කරන්න.\n2. SMS දැනුම්දීම් සැකසීම: ශේෂය අඩුවීමේ අනතුරු ඇඟවීම් සහ ගෙවීම් රිසිට්පත් SMS මඟින් ලබා ගැනීමට 'සැකසුම්' (Settings) වෙත ගොස් ඔබගේ දුරකථන අංකය යාවත්කාලීන කරන්න.\n3. මාසික අයවැය සීමාවන්: ඩෑෂ්බෝඩ් එකේ 'Budget & Alerts' මඟින් ඔබට මාසික උපරිම රුපියල් සීමාවක් සහ දෛනික kWh ඉලක්කයක් සකස් කළ හැක.`;
    }
    if (lang === 'ta') {
      return `[கணக்கு மற்றும் ஸ்மார்ட் மீட்டர் மேலாண்மை]:\n\n1. புதிய மீட்டரை இணைத்தல்: உங்கள் கணக்கில் மற்றொரு மீட்டரை சேர்க்க 'மீட்டர் சேர்க்க' (Add Meter) பகுதிக்குச் சென்று 9 இலக்க மீட்டர் எண் மற்றும் ரகசிய பின் (PIN) குறியீட்டை உள்ளிடவும்.\n2. SMS எச்சரிக்கை அமைப்புகள்: குறைந்த இருப்பு எச்சரிக்கைகள் மற்றும் ரசீதுகளைப் பெற 'அமைப்புகள்' (Settings) பகுதியில் உங்கள் மொபைல் எண்ணை சரிபார்க்கவும்.\n3. மாதாந்திர பட்ஜெட் வரம்பு: உங்கள் டாஷ்போர்டில் உள்ள 'Budget & Alerts' மூலம் மாதாந்திர செலவு வரம்பை நிர்ணயிக்கலாம்.`;
    }
    return `[ACCOUNT & SMART METER MANAGEMENT]:\n\n1. Linking Additional Meters: You can manage multiple smart meters under a single user account. Navigate to 'Add Meter' and enter the 9-digit LECO meter number and secret PIN from your smart meter card.\n2. Real-Time SMS Alerts: Update your verified mobile number under 'Settings' to receive instant SMS notifications for low balance thresholds (e.g. <= Rs. 100) and recharge confirmations.\n3. Monthly Budget & Spending Targets: Click 'Budget & Alerts' on your dashboard to set customized monthly LKR budget limits and daily kWh targets to avoid unexpected billing surprises.`;
  }

  // 13. Complaints, Ticket Tracking & Breakdown Hotline Query (Complaints)
  const isHelpQuery = query.includes('complaint') || query.includes('outage') || query.includes('hotline') ||
    query.includes('1987') || query.includes('1910') || query.includes('support') || query.includes('breakdown') ||
    query.includes('ticket') || query.includes('dispute') || query.includes('voltage') || query.includes('repair') ||
    query.includes('defect') || query.includes('flicker') || query.includes('පැමිණිලි') || query.includes('ඇනහිටීම්') ||
    query.includes('දෝෂ') || query.includes('புகார்') || query.includes('மின்தடை') || query.includes('மின்னழுத்தம்');

  if (isHelpQuery) {
    if (lang === 'si') {
      return `[LECO පාරිභෝගික සහාය සහ පැමිණිලි විසඳීම]:\n\n1. හදිසි බිඳවැටීම් සහ අනතුරු සඳහා 24/7 ක්ෂණික ඇමතුම් අංකය: 1987 (නොමිලේ).\n2. පාරිභෝගික සේවා මධ්‍යස්ථානය: 1910.\n3. ඩෑෂ්බෝඩ් එක හරහා පැමිණිලි ඉදිරිපත් කිරීම:\nඔබගේ ඩෑෂ්බෝඩ් එකේ 'පැමිණිලි සහ සහාය' (Complaints) අංශය වෙත පිවිස පහත වර්ග යටතේ ටිකට් පතක් ඉදිරිපත් කළ හැක:\n- විදුලිය ඇනහිටීම් සහ ප්‍රදේශයේ බිඳවැටීම්\n- බිල්පත් සහ රීචාර්ජ් ගැටලු\n- මීටරයේ දෝෂ හෝ අක්‍රියතා\n- අඩු වෝල්ටීයතාවය හෝ විදුලි උච්චාවචනයන් (Voltage Fluctuation)\nසෑම පැමිණිල්ලකටම ටිකට් අංකයක් (Ticket Number) ලැබෙන අතර එහි තත්ත්වය ඩෑෂ්බෝඩ් එකෙන් සජීවීව පරීක්ෂා කළ හැක.`;
    }
    if (lang === 'ta') {
      return `[LECO வாடிக்கையாளர் உதவி மற்றும் புகார் தீர்வு]:\n\n1. 24/7 அவசர மின்சார முறிவு உதவி எண்: 1987 (இலவசம்).\n2. தேசிய வாடிக்கையாளர் அழைப்பு மையம்: 1910.\n3. டாஷ்போர்டு மூலம் புகார் பதிவு செய்தல்:\nஉங்கள் டாஷ்போர்டில் உள்ள 'Complaints & Support' பகுதி மூலம் பின்வரும் பிரிவுகளில் புகார் பதிவு செய்யலாம்:\n- மின் தடைகள் மற்றும் பகுதி முறிவுகள்\n- கட்டணம் மற்றும் ரீசார்ஜ் முரண்பாடுகள்\n- மீட்டர் காட்சி மற்றும் வன்பொருள் கோளாறுகள்\n- குறைந்த மின்னழுத்தம் மற்றும் மாறுபாடுகள் (Voltage Fluctuation)\nஒவ்வொரு புகாருக்கும் ஒரு டிக்கெட் எண் வழங்கப்படும், அதன் நிலையை டாஷ்போர்டில் கண்காணிக்கலாம்.`;
    }
    return `[LECO CUSTOMER SUPPORT & COMPLAINT RESOLUTION]:\n\n1. 24/7 Emergency Breakdown Hotline: Dial 1987 (toll-free across Sri Lanka for sparking, wire snapping, or power outages).\n2. National Call Centre: 1910.\n3. In-App Complaints Ticketing Portal:\nNavigate to the 'Complaints & Support' tab on your dashboard to submit a formal ticket under categories:\n- Power Outage & Local Breakdown\n- Billing & Top-Up Ledger Disputes\n- Meter Hardware / Display Defect\n- Voltage Fluctuation (voltage below 210V or above 250V)\nEach ticket receives a unique tracking number (e.g. CMP-2026-XXXX) and resolution progress can be tracked in real-time.`;
  }

  // 14. General Off-Topic Handling
  const isOffTopic = query.includes('weather') || query.includes('recipe') || query.includes('movie') ||
    query.includes('joke') || query.includes('කාලගුණය') || query.includes('வானிலை');

  if (isOffTopic) {
    if (lang === 'si') {
      return "මම LECO ස්මාර්ට් බලශක්ති සහයකයා වෙමි. මම විදුලි පරිභෝජනය, පෙරගෙවුම් ස්මාර්ට් මීටර් කළමනාකරණය, ගාස්තු, බලශක්ති ඉතිරිකිරීම්, ගිණුම් සහ පැමිණිලි පිළිබඳ විශේෂඥයෙක්මි. ඔබගේ විදුලි සැපයුම සම්බන්ධයෙන් මට ඔබට උපකාර කළ හැක්කේ කෙසේද?";
    }
    if (lang === 'ta') {
      return "நான் LECO ஸ்மார்ட் மின்சார உதவியாளர். நான் மின்சார பயன்பாடு, சேமிப்பு, கணக்கு மேலாண்மை மற்றும் புகார்கள் ஆகியவற்றில் நிபுணத்துவம் பெற்றுள்ளேன். உங்கள் மின்சார கணக்கு குறித்து நான் எவ்வாறு உதவ முடியும்?";
    }
    return "I am the LECO Smart Energy Assistant. I specialize in electricity consumption, tariffs, energy savings, prepaid smart meters, accounts, and complaints. How can I help with your LECO electricity service?";
  }

  // 15. General Greeting / Fallback
  if (lang === 'si') {
    return "ආයුබෝවන්! මම ඔබගේ LECO ස්මාර්ට් බලශක්ති සහයකයා වෙමි. මට ඔබට උපකාර කළ හැක්කේ:\n- විදුලි පරිභෝජනය (සතිපතා භාවිතය, දින කීයක් ඉතිරිද, බිල වැඩිවීමට හේතු)\n- බලශක්ති ඉතිරිකිරීම් (PUCSL ගාස්තු කාණ්ඩ, Peak වේලාවන්, උපකරණ ඉතිරිකිරීම්)\n- ගිණුම් කළමනාකරණය (ශේෂය රීචාර්ජ් කිරීම, Lifeline හදිසි ණය, නව මීටර් සම්බන්ධ කිරීම)\n- පැමිණිලි සහ සහාය (විදුලි ඇනහිටීම් වාර්තා කිරීම, 1987 ක්ෂණික ඇමතුම්)\n\nඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?";
  }
  if (lang === 'ta') {
    return "வணக்கம்! நான் உங்கள் LECO ஸ்மார்ட் மின்சார உதவியாளர். நான் உங்களுக்கு உதவக்கூடியவை:\n- மின்சார பயன்பாடு (வாராந்திர நுகர்வு, மீதமுள்ள நாட்கள், அதிக கட்டண ஆய்வு)\n- மின் சேமிப்பு (PUCSL கட்டண அடுக்குகள், உச்ச நேரம், உபகரண பயன்பாடு)\n- கணக்கு மேலாண்மை (ரீசார்ஜ், அவசர கடன், புதிய மீட்டர் சேர்த்தல்)\n- புகார்கள் மற்றும் ஆதரவு (மின் தடை புகார், 1987 அவசர உதவி எண்)\n\nநீங்கள் எதை அறிய விரும்புகிறீர்கள்?";
  }

  return "Hello! I am your LECO Smart Energy Assistant. I can help you with:\n- Electricity Usage (Estimating how many days your balance will last, daily burn rate, weekly trends, solar net metering, high bill investigation)\n- Energy Savings (PUCSL block tariffs, Time-of-Use peak shifting, appliance consumption)\n- Account & Payments (Prepaid balance, instant recharge, Lifeline emergency credit, multi-meter linking)\n- Complaints & Support (Reporting outages, voltage disputes, 1987 24/7 emergency hotline)\n\nWhat would you like to know?";
}

module.exports = {
  generateOfflineReply
};
