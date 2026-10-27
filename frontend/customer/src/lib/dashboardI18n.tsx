import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

/**
 * Customer Dashboard Tri-lingual Translations
 * Supported: English (en), Sinhala (si), Tamil (ta)
 * 
 * Keep all customer dashboard and interior section translations in this single file.
 * This file is completely separated from the Login Page i18n (i18n.ts) so language
 * corrections can easily be made in one central location.
 * 
 * Note: Per project policy, no emojis are used in UI designs.
 */

export type DashboardLanguage = "en" | "si" | "ta"

export interface DashboardTranslations {
  nav: {
    overview: string
    addMeter: string
    payments: string
    history: string
    complaints: string
    settings: string
    logout: string
    navigationLabel: string
  }
  dock: {
    overview: string
    recharge: string
    history: string
    help: string
    settings: string
  }
  header: {
    portalTitle: string
    eMeter: string
    notifications: string
    unread: string
    noNotifications: string
    markAllRead: string
    userRole: string
  }
  errorBoundary: {
    title: string
    genericDesc: string
    reloadBtn: string
  }
  overview: {
    title: string
    welcomeBack: string
    availableBalance: string
    prepaidWallet: string
    lifelineActive: string
    currentTariff: string
    depositedCreditNotice: string
    daysRemaining: string
    daysRemainingBuffer: string
    calculating: string
    projectedNetAfterSettlement: string
    currentMonthAccruedBill: string
    pucslTariff: string
    energyCharge: string
    fixedCharge: string
    tariffGroup: string
    rechargeNow: string
    settleCycle: string
    meterStatus: string
    connection: string
    tariffPlan: string
    domesticBlock: string
    meterNo: string
    accountNo: string
    billingCycle: string
    pucslStandard: string
    electricityConsumption: string
    todayNet: string
    thisWeekNet: string
    livePowerNet: string
    inFlow: string
    outFlow: string
    usageComparison: string
    todayVsYesterday: string
    thisWeekVsLastWeek: string
    tariffLifetimePrediction: string
    confidence: string
    highConfidence: string
    mediumConfidence: string
    simulationNotice: string
    expectedRange: string
    emergencyCreditActiveTitle: string
    powerProtected: string
    emergencyCreditActiveDesc: string
    bufferUsed: string
    bufferLeft: string
    rechargeClearDebt: string
    emergencyCreditAvailableTitle: string
    lifelineProtection: string
    emergencyCreditAvailableDesc: string
    activateCredit: string
    activating: string
    simulatorTitle: string
    testSandbox: string
    simulatorDesc: string
    hide: string
    expand: string
    usage: string
    clear: string
    budgetSectionTitle: string
    monthlyBudgetTitle: string
    dailyBudgetTitle: string
    lowBalanceNotificationTitle: string
    adjustBudgetBtn: string
    spentOf: string
    remainingOf: string
    simplifiedView: string
    detailedView: string
    simplifiedViewDesc: string
    supplyDaysTitle: string
    supplyDaysSubtext: string
    dailyEstimateTitle: string
    dailyEstimateSubtext: string
    actualUsage: string
    predictedUsage: string
    todayUsageTitle: string
    activeLoadTitle: string
    connectedGrid: string
    disconnectedGrid: string
    daysUnit: string
    perDayUnit: string
    savingTipTitle: string
    savingTipDesc: string
    quickActions: string
  }
  addMeter: {
    title: string
    subtitle: string
    meterNumberLabel: string
    meterNumberPlaceholder: string
    accountNumberLabel: string
    accountNumberPlaceholder: string
    pinLabel: string
    pinPlaceholder: string
    verifyBtn: string
    meterFound: string
    verificationSuccess: string
    locationLabel: string
    connectionLabel: string
    activeStatus: string
    tariffLabel: string
    domesticTariff: string
    cancelBtn: string
    addMeterBtn: string
    meterAddedSuccess: string
    meterLinkedDesc: string
    addAnotherMeter: string
    viewInOverview: string
    errorAddingMeter: string
    tryAgain: string
    myLinkedMeters: string
    manageMetersDesc: string
    activeDefault: string
    noMetersYet: string
    balancePrefix: string
  }
  payments: {
    title: string
    subtitle: string
    noMeterTitle: string
    noMeterDesc: string
    targetMeter: string
    currentBalance: string
    debtNoticeTitle: string
    debtNoticeDesc: string
    selectMeterLabel: string
    chooseAmount: string
    orCustomAmount: string
    customPlaceholder: string
    continueBtn: string
    totalToPay: string
    paymentMethod: string
    methodPayhere: string
    methodCard: string
    methodWallet: string
    methodBank: string
    payhereNotice: string
    payhereSecureBadge: string
    backBtn: string
    confirmAndPay: string
    creditingTitle: string
    creditingDesc: string
    successTitle: string
    successDesc: string
    viewReceiptHistory: string
    backToOverview: string
    paymentFailed: string
    networkError: string
  }
  history: {
    title: string
    subtitle: string
    filterAll: string
    filterCard: string
    filterWallet: string
    filterBank: string
    searchPlaceholder: string
    totalTransactions: string
    totalSpent: string
    successfulRecharges: string
    dateCol: string
    referenceCol: string
    meterCol: string
    amountCol: string
    methodCol: string
    statusCol: string
    receiptCol: string
    viewReceipt: string
    noRecords: string
    noRecordsDesc: string
    completed: string
    pending: string
    failed: string
    receiptModalTitle: string
    officialReceipt: string
    transactionId: string
    paymentDate: string
    meterNumber: string
    previousBalance: string
    newBalance: string
    closeBtn: string
  }
  complaints: {
    title: string
    subtitle: string
    newComplaint: string
    myComplaints: string
    selectCategory: string
    priorityLabel: string
    subjectLabel: string
    subjectPlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    meterOptional: string
    selectMeter: string
    submitBtn: string
    submitting: string
    filterAll: string
    filterActive: string
    filterResolved: string
    searchPlaceholder: string
    noComplaints: string
    ticketNumber: string
    statusLabel: string
    queued: string
    inReview: string
    investigating: string
    resolved: string
    closed: string
    priorityLow: string
    priorityMedium: string
    priorityHigh: string
    priorityEmergency: string
    typeRechargeProblem: string
    typeIncorrectBalance: string
    typeMeterFault: string
    typePowerInterruption: string
    typeHighConsumption: string
    typeVoltageFluctuation: string
    typeConnectionProblem: string
    typeOther: string
    feedbackSubmitted: string
  }
  settings: {
    title: string
    subtitle: string
    tabAlerts: string
    tabNotifications: string
    tabSecurity: string
    accountProfile: string
    emailLabel: string
    phoneLabel: string
    roleLabel: string
    customerRole: string
    energyPreferences: string
    monthlyBudget: string
    lowBalanceThreshold: string
    dailyBudget: string
    autoEmergencyCredit: string
    autoEmergencyCreditDesc: string
    nightCurfew: string
    nightCurfewDesc: string
    notificationChannels: string
    smsNotifications: string
    smsNotificationsDesc: string
    emailNotifications: string
    emailNotificationsDesc: string
    weeklyDigest: string
    weeklyDigestDesc: string
    securitySettings: string
    changePassword: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    savePreferences: string
    saving: string
    savedSuccess: string
    logoutBtn: string
    passwordsDoNotMatch: string
    passwordMinLength: string
    showPasswords: string
  }
  bot: {
    askAi: string
    title: string
    agentBadge: string
    statusOnline: string
    welcomeMessage: string
    promptDaysLeft: string
    promptLastTopup: string
    promptCompareUsage: string
    promptLifelineActive: string
    inputPlaceholder: string
    typingNotice: string
    networkError: string
    fallbackReply: string
  }
}

export const dashboardTranslations: Record<DashboardLanguage, DashboardTranslations> = {
  en: {
    nav: {
      overview: "Overview",
      addMeter: "Add Meter",
      payments: "Payments",
      history: "Payment History",
      complaints: "Complaints & Support",
      settings: "Settings",
      logout: "Sign Out",
      navigationLabel: "Navigation",
    },
    dock: {
      overview: "Overview",
      recharge: "Recharge",
      history: "History",
      help: "Help",
      settings: "Settings",
    },
    header: {
      portalTitle: "LECO Self Care",
      eMeter: "LECO Self Care",
      notifications: "Notifications",
      unread: "unread",
      noNotifications: "No notifications",
      markAllRead: "Mark all as read",
      userRole: "Customer",
    },
    errorBoundary: {
      title: "Failed to display this section",
      genericDesc: "An unexpected error occurred while rendering this section.",
      reloadBtn: "Reload Section",
    },
    overview: {
      title: "Overview",
      welcomeBack: "Welcome back",
      availableBalance: "Available Prepaid Balance",
      prepaidWallet: "Prepaid Wallet",
      lifelineActive: "Lifeline Active",
      currentTariff: "PUCSL Tariff",
      depositedCreditNotice: "Deposited credit • Not deducted during cycle",
      daysRemaining: "days remaining",
      daysRemainingBuffer: "days (on buffer)",
      calculating: "Calculating...",
      projectedNetAfterSettlement: "Projected Net after Settlement",
      currentMonthAccruedBill: "Current Month Accrued Bill",
      pucslTariff: "PUCSL Tariff",
      energyCharge: "Energy Charge",
      fixedCharge: "Fixed Monthly Charge",
      tariffGroup: "Tariff Group",
      rechargeNow: "Recharge Now",
      settleCycle: "Settle Cycle",
      meterStatus: "Meter Status",
      connection: "Connection",
      tariffPlan: "Tariff Plan",
      domesticBlock: "Domestic Block",
      meterNo: "Meter No.",
      accountNo: "Account No.",
      billingCycle: "Billing Cycle: 30-day",
      pucslStandard: "PUCSL Standard",
      electricityConsumption: "Electricity Consumption",
      todayNet: "Today — Net (In − Out)",
      thisWeekNet: "This Week — Net (In − Out)",
      livePowerNet: "Live Power — Net (In − Out)",
      inFlow: "In",
      outFlow: "Out",
      usageComparison: "Net Usage Comparison — In − Out (vs Previous Period)",
      todayVsYesterday: "Today vs Yesterday",
      thisWeekVsLastWeek: "This week vs Last week",
      tariffLifetimePrediction: "Tariff Lifetime Prediction",
      confidence: "Confidence",
      highConfidence: "HIGH",
      mediumConfidence: "MEDIUM",
      simulationNotice: "Nonlinear day-by-day simulation under official Sri Lankan domestic tariffs",
      expectedRange: "Expected Range",
      emergencyCreditActiveTitle: "Emergency Credit Active (Lifeline Mode)",
      powerProtected: "Power Protected",
      emergencyCreditActiveDesc: "Your power remains connected. Your emergency buffer prevents cut-offs during late hours or critical times.",
      bufferUsed: "Buffer Used",
      bufferLeft: "Buffer Left",
      rechargeClearDebt: "Recharge & Clear Debt",
      emergencyCreditAvailableTitle: "Emergency Credit Available",
      lifelineProtection: "Lifeline Protection",
      emergencyCreditAvailableDesc: "Your prepaid balance is low. Avoid sudden power interruption by activating Emergency Credit.",
      activateCredit: "Activate Credit",
      activating: "Activating...",
      simulatorTitle: "Live Simulator",
      testSandbox: "Test Sandbox",
      simulatorDesc: "Simulate real consumption in kWh: updates accrued monthly usage & PUCSL block tariff in real time.",
      hide: "Hide",
      expand: "Expand",
      usage: "Usage",
      clear: "Clear",
      budgetSectionTitle: "Monthly Budget & Alert Settings",
      monthlyBudgetTitle: "Monthly Electricity Budget",
      dailyBudgetTitle: "Daily Target Usage",
      lowBalanceNotificationTitle: "Prepaid Low Balance Alert",
      adjustBudgetBtn: "Adjust Budget & Alerts",
      spentOf: "spent of",
      remainingOf: "remaining",
      simplifiedView: "Simplified View",
      detailedView: "Detailed View",
      simplifiedViewDesc: "Clean, non-technical dashboard tailored for everyday home use",
      supplyDaysTitle: "Estimated Supply Horizon",
      supplyDaysSubtext: "Estimated power supply will last until",
      dailyEstimateTitle: "Daily Cost Estimation",
      dailyEstimateSubtext: "Average daily electricity cost",
      actualUsage: "Real Usage",
      predictedUsage: "Predicted Usage",
      todayUsageTitle: "Today's Energy Usage",
      activeLoadTitle: "Current Power Draw",
      connectedGrid: "Connected to Grid",
      disconnectedGrid: "Grid Disconnected",
      daysUnit: "Days",
      perDayUnit: "/ day",
      savingTipTitle: "Energy Saving Tip",
      savingTipDesc: "Reduce high-power appliances (iron, oven, water heater) during peak hours (6:30 PM - 10:30 PM) to minimize your monthly bill.",
      quickActions: "Quick Actions",
    },
    addMeter: {
      title: "Add Existing Smart Meter",
      subtitle: "Link a smart meter to your account to monitor consumption and recharge.",
      meterNumberLabel: "Meter Number",
      meterNumberPlaceholder: "e.g. 123456789",
      accountNumberLabel: "Account Number",
      accountNumberPlaceholder: "e.g. 1234567890",
      pinLabel: "Meter PIN / Verification Code",
      pinPlaceholder: "******",
      verifyBtn: "Verify Meter",
      meterFound: "Meter Found",
      verificationSuccess: "Verification successful",
      locationLabel: "Location",
      connectionLabel: "Connection",
      activeStatus: "Active",
      tariffLabel: "Tariff",
      domesticTariff: "Domestic",
      cancelBtn: "Cancel",
      addMeterBtn: "Add Meter",
      meterAddedSuccess: "Meter Added Successfully!",
      meterLinkedDesc: "has been linked to your account.",
      addAnotherMeter: "Add Another Meter",
      viewInOverview: "View in Overview",
      errorAddingMeter: "Error Adding Meter",
      tryAgain: "Try Again",
      myLinkedMeters: "My Linked Meters",
      manageMetersDesc: "Manage all meters associated with your profile",
      activeDefault: "Active Default",
      noMetersYet: "No meters added yet.",
      balancePrefix: "Balance",
    },
    payments: {
      title: "Recharge Prepaid Meter",
      subtitle: "Top up your meter credit instantly via card, wallet, or bank transfer.",
      noMeterTitle: "No Meter Connected",
      noMeterDesc: "You need to add a smart meter before you can recharge. Go to Add Meter first.",
      targetMeter: "Target Smart Meter",
      currentBalance: "Current Balance",
      debtNoticeTitle: "Emergency Credit Debt Recovery",
      debtNoticeDesc: "This meter has an active Lifeline buffer with an outstanding debt. Your recharge will first automatically settle this debt.",
      selectMeterLabel: "Select Meter to Recharge",
      chooseAmount: "Choose Recharge Amount",
      orCustomAmount: "Or Enter Custom Amount",
      customPlaceholder: "e.g. 1500",
      continueBtn: "Continue to Payment",
      totalToPay: "Total to Pay",
      paymentMethod: "Payment Method",
      methodPayhere: "PayHere Online Gateway (Visa, Master, Amex, eZ Cash, mCash, Genie, Vishwa)",
      methodCard: "Credit / Debit Card (Visa, Mastercard)",
      methodWallet: "Mobile Wallet / QR Payment",
      methodBank: "Online Bank Transfer",
      payhereNotice: "Secured by PayHere Central Bank approved National Payment Gateway",
      payhereSecureBadge: "PayHere 256-Bit SSL Encrypted",
      backBtn: "Back",
      confirmAndPay: "Confirm & Pay",
      creditingTitle: "Crediting Your Smart Meter...",
      creditingDesc: "Contacting payment gateway. Please wait a moment.",
      successTitle: "Recharge Successful!",
      successDesc: "Your meter has been credited immediately.",
      viewReceiptHistory: "View Receipt & History",
      backToOverview: "Back to Overview",
      paymentFailed: "Payment failed",
      networkError: "Network error. Please try again.",
    },
    history: {
      title: "Payment History",
      subtitle: "View and download all your past recharge receipts and payment details.",
      filterAll: "All Methods",
      filterCard: "Card",
      filterWallet: "Wallet",
      filterBank: "Bank",
      searchPlaceholder: "Search by Transaction ID or meter...",
      totalTransactions: "Total Transactions",
      totalSpent: "Total Recharged",
      successfulRecharges: "Successful",
      dateCol: "Date & Time",
      referenceCol: "Transaction ID",
      meterCol: "Meter No.",
      amountCol: "Amount",
      methodCol: "Method",
      statusCol: "Status",
      receiptCol: "Receipt",
      viewReceipt: "View Receipt",
      noRecords: "No Payment Records Found",
      noRecordsDesc: "You have not made any recharges yet, or no transactions match your filters.",
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      receiptModalTitle: "Recharge Receipt",
      officialReceipt: "Official LECO Smart Meter E-Receipt",
      transactionId: "Transaction ID",
      paymentDate: "Payment Date",
      meterNumber: "Meter Number",
      previousBalance: "Previous Balance",
      newBalance: "Updated Balance",
      closeBtn: "Close Receipt",
    },
    complaints: {
      title: "Complaints & Support",
      subtitle: "Report electricity supply interruptions, meter issues, or billing inquiries directly to LECO.",
      newComplaint: "Submit New Ticket",
      myComplaints: "My Support Tickets",
      selectCategory: "Complaint Category",
      priorityLabel: "Priority Level",
      subjectLabel: "Subject",
      subjectPlaceholder: "Brief summary of the issue...",
      descriptionLabel: "Detailed Description",
      descriptionPlaceholder: "Please describe what happened in detail...",
      meterOptional: "Meter (Optional)",
      selectMeter: "Select relevant meter",
      submitBtn: "Submit Complaint",
      submitting: "Submitting...",
      filterAll: "All Tickets",
      filterActive: "Active",
      filterResolved: "Resolved",
      searchPlaceholder: "Search tickets by title, number, or meter...",
      noComplaints: "No support tickets found.",
      ticketNumber: "Ticket",
      statusLabel: "Status",
      queued: "Queued",
      inReview: "In Review",
      investigating: "Investigating",
      resolved: "Resolved",
      closed: "Closed",
      priorityLow: "Low Priority",
      priorityMedium: "Medium Priority",
      priorityHigh: "High Priority",
      priorityEmergency: "Emergency Breakdown",
      typeRechargeProblem: "Recharge / Token Issue",
      typeIncorrectBalance: "Incorrect Balance",
      typeMeterFault: "Meter Hardware Issue",
      typePowerInterruption: "Power Interruption",
      typeHighConsumption: "High Consumption Surge",
      typeVoltageFluctuation: "Voltage Fluctuation",
      typeConnectionProblem: "Smart Connectivity Problem",
      typeOther: "Other Support Request",
      feedbackSubmitted: "Your ticket has been submitted to LECO engineers.",
    },
    settings: {
      title: "Account & Energy Settings",
      subtitle: "Manage your profile, language, alert preferences, and account security.",
      tabAlerts: "Energy Alerts",
      tabNotifications: "Notifications",
      tabSecurity: "Security",
      accountProfile: "Customer Profile",
      emailLabel: "Email Address",
      phoneLabel: "Mobile Phone",
      roleLabel: "Account Type",
      customerRole: "Prepaid Customer",
      energyPreferences: "Smart Energy Preferences",
      monthlyBudget: "Target Monthly Budget (Rs.)",
      lowBalanceThreshold: "Low Balance Warning Limit (Rs.)",
      dailyBudget: "Target Daily Budget (kWh)",
      autoEmergencyCredit: "Automatic Emergency Credit Activation",
      autoEmergencyCreditDesc: "Auto-activate lifeline credit when balance drops to zero at night.",
      nightCurfew: "Night Curfew Power Protection",
      nightCurfewDesc: "Never disconnect during night hours (10:00 PM - 06:00 AM).",
      notificationChannels: "Notification Channels",
      smsNotifications: "SMS Alerts for Low Balance & Recharges",
      smsNotificationsDesc: "Receive instant SMS notifications on your mobile.",
      emailNotifications: "Email Invoices & Statements",
      emailNotificationsDesc: "Get monthly usage breakdowns directly in your inbox.",
      weeklyDigest: "Weekly Energy Consumption Summary",
      weeklyDigestDesc: "Weekly comparison report showing energy conservation progress.",
      securitySettings: "Security & Password",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm New Password",
      savePreferences: "Save Preferences",
      saving: "Saving...",
      savedSuccess: "Settings saved successfully!",
      logoutBtn: "Sign Out",
      passwordsDoNotMatch: "New passwords do not match",
      passwordMinLength: "Password must be at least 10 characters",
      showPasswords: "Show Passwords",
    },
    bot: {
      askAi: "Ask LECO Energy AI",
      title: "LECO Energy Assistant",
      agentBadge: "AI Agent",
      statusOnline: "Online • Live Telemetry Connected",
      welcomeMessage: "Hello! I am your **LECO Smart Energy Assistant**.\n\nI can analyze your live meter telemetry, check how many days your balance will last, explain your PUCSL tariff tiers, or review past top-ups. How can I help you today?",
      promptDaysLeft: "How many days will my top-up last?",
      promptLastTopup: "What was my last top-up?",
      promptCompareUsage: "Compare my weekly electricity usage",
      promptLifelineActive: "Is Lifeline Mode active?",
      inputPlaceholder: "Ask about days left, tariffs, usage...",
      typingNotice: "Querying energy engine...",
      networkError: "I encountered a network issue connecting to the energy database. Please try again.",
      fallbackReply: "I am currently unable to process your request. Please try again shortly.",
    },
  },

  si: {
    nav: {
      overview: "දළ විශ්ලේෂණය",
      addMeter: "මීටරයක් එක් කරන්න",
      payments: "ගෙවීම් (රීචාර්ජ්)",
      history: "ගෙවීම් ඉතිහාසය",
      complaints: "පැමිණිලි සහ සහාය",
      settings: "සැකසුම්",
      logout: "පිටවීම",
      navigationLabel: "ප්‍රධාන මෙනුව",
    },
    dock: {
      overview: "විස්තරය",
      recharge: "රීචාර්ජ්",
      history: "ඉතිහාසය",
      help: "සහාය",
      settings: "සැකසුම්",
    },
    header: {
      portalTitle: "LECO Self Care",
      eMeter: "LECO Self Care",
      notifications: "දැනුම්දීම්",
      unread: "නොකියවූ",
      noNotifications: "නව දැනුම්දීම් නොමැත",
      markAllRead: "සියල්ල කියවූ ලෙස සලකුණු කරන්න",
      userRole: "පාරිභෝගික",
    },
    errorBoundary: {
      title: "මෙම කොටස පෙන්වීමේදී දෝෂයක් ඇති විය",
      genericDesc: "මෙම පිටුව පූරණය කිරීමේදී අනපේක්ෂිත දෝෂයක් සිදු විය.",
      reloadBtn: "නැවත පූරණය කරන්න",
    },
    overview: {
      title: "දළ විශ්ලේෂණය",
      welcomeBack: "නැවත පැමිණීම සාදරයෙන් පිළිගනිමු",
      availableBalance: "පවතින පෙරගෙවුම් ශේෂය",
      prepaidWallet: "පෙරගෙවුම් මුදල් පසුම්බිය",
      lifelineActive: "හදිසි ණය සක්‍රීයයි",
      currentTariff: "PUCSL ගාස්තු ක්‍රමය",
      depositedCreditNotice: "තැන්පත් කළ මුදල • මාසික ගිණුම්කරණය තෙක් අඩු නොවේ",
      daysRemaining: "දින ඉතිරිව ඇත",
      daysRemainingBuffer: "දින (හදිසි ණය මඟින්)",
      calculating: "ගණනය කරමින් පවතී...",
      projectedNetAfterSettlement: "මාසික ගිණුම් පියවීමෙන් පසු ඉතිරිවන ශේෂය",
      currentMonthAccruedBill: "මේ මස මේ දක්වා වැයවූ බිල්පත් මුදල",
      pucslTariff: "PUCSL ගාස්තුව",
      energyCharge: "විදුලි ඒකක ගාස්තුව",
      fixedCharge: "මාසික ස්ථාවර ගාස්තුව",
      tariffGroup: "ගාස්තු කාණ්ඩය",
      rechargeNow: "දැන් රීචාර්ජ් කරන්න",
      settleCycle: "ගිණුම පියවන්න",
      meterStatus: "මීටරයේ තත්ත්වය",
      connection: "සම්බන්ධතාවය",
      tariffPlan: "ගාස්තු සැලැස්ම",
      domesticBlock: "ගෘහස්ථ කාණ්ඩය",
      meterNo: "මීටර් අංකය",
      accountNo: "ගිණුම් අංකය",
      billingCycle: "දින 30 ක චක්‍රය",
      pucslStandard: "PUCSL සම්මතය",
      electricityConsumption: "විදුලි පරිභෝජනය",
      todayNet: "අද දින — ශුද්ධ භාවිතය (ඇතුළත් − බැහැර)",
      thisWeekNet: "මෙම සතිය — ශුද්ධ භාවිතය (ඇතුළත් − බැහැර)",
      livePowerNet: "සජීවී ධාරිතාව — ශුද්ධ (ඇතුළත් − බැහැර)",
      inFlow: "පරිභෝජනය",
      outFlow: "ප්‍රතිදානය",
      usageComparison: "පරිභෝජන සැසඳීම (පෙර කාලසීමාවට සාපේක්ෂව)",
      todayVsYesterday: "අද සහ ඊයේ අතර වෙනස",
      thisWeekVsLastWeek: "මෙම සතිය සහ පසුගිය සතිය අතර වෙනස",
      tariffLifetimePrediction: "ශේෂය ප්‍රමාණවත් වන දින පුරෝකථනය",
      confidence: "විශ්වාසනීයත්වය",
      highConfidence: "ඉහළයි",
      mediumConfidence: "මධ්‍යමයි",
      simulationNotice: "ශ්‍රී ලංකා මහජන උපයෝගිතා කොමිසමේ (PUCSL) නිල ගාස්තු ක්‍රමයට අනුව ගණනය කර ඇත",
      expectedRange: "අපේක්ෂිත දින පරාසය",
      emergencyCreditActiveTitle: "හදිසි ණය සක්‍රීයයි (Lifeline Mode)",
      powerProtected: "විදුලිය විසන්ධි නොවේ",
      emergencyCreditActiveDesc: "ඔබගේ විදුලි සැපයුම නොනැවතී පවතී. හදිසි අවස්ථාවලදී විදුලිය විසන්ධි වීම වැළැක්වීමට අමතර ණය පහසුකම උපකාරී වේ.",
      bufferUsed: "භාවිතා කළ ණය ප්‍රමාණය",
      bufferLeft: "ඉතිරි ණය ප්‍රමාණය",
      rechargeClearDebt: "රීචාර්ජ් කර ණය පියවන්න",
      emergencyCreditAvailableTitle: "හදිසි ණය පහසුකම ලබාගත හැක",
      lifelineProtection: "විදුලිය ආරක්ෂා කිරීම",
      emergencyCreditAvailableDesc: "ඔබගේ පෙරගෙවුම් ශේෂය අවම මට්ටමක පවතී. විදුලිය විසන්ධි වීම වළක්වා ගැනීමට හදිසි ණය පහසුකම සක්‍රීය කරගන්න.",
      activateCredit: "ණය ලබාගන්න",
      activating: "සක්‍රීය වෙමින් පවතී...",
      simulatorTitle: "සජීවී මීටර් අනුකරණය (Simulator)",
      testSandbox: "පරීක්ෂණ මාදිලිය",
      simulatorDesc: "විදුලි ඒකක පරිභෝජනය අනුකරණය කර PUCSL ගාස්තු සහ ඉතිරි දින ගණනය වන ආකාරය බලන්න.",
      hide: "සඟවන්න",
      expand: "විහිදුවන්න",
      usage: "පරිභෝජනය",
      clear: "ඉවත් කරන්න",
      budgetSectionTitle: "මාසික අයවැය සහ අනතුරු ඇඟවීමේ සැකසුම්",
      monthlyBudgetTitle: "මාසික විදුලි වියදම් ඉලක්කය",
      dailyBudgetTitle: "දෛනික ඉලක්කගත ඒකක ප්‍රමාණය",
      lowBalanceNotificationTitle: "අඩු ශේෂ අනතුරු ඇඟවීම",
      adjustBudgetBtn: "අයවැය සහ දැනුම්දීම් සකසන්න",
      spentOf: "වැයවූ මුදල (මුළු ඉලක්කයෙන්)",
      remainingOf: "ඉතිරි මුදල",
      simplifiedView: "සරල දැක්ම",
      detailedView: "සවිස්තර දැක්ම",
      simplifiedViewDesc: "නිවසේ එදිනෙදා භාවිතයට පහසු, පැහැදිලි සරල තිරය",
      supplyDaysTitle: "විදුලිය පවතින ඇස්තමේන්තුගත කාලය",
      supplyDaysSubtext: "විදුලි සැපයුම පවතිනු ඇතැයි අපේක්ෂිත දිනය",
      dailyEstimateTitle: "දෛනික ඇස්තමේන්තුගත වියදම",
      dailyEstimateSubtext: "සාමාන්‍ය දෛනික විදුලි වියදම",
      actualUsage: "සැබෑ භාවිතය",
      predictedUsage: "පුරෝකථනය කළ භාවිතය",
      todayUsageTitle: "අද දින විදුලි භාවිතය",
      activeLoadTitle: "වත්මන් විදුලි ධාරිතාව",
      connectedGrid: "විදුලිබල පද්ධතියට සම්බන්ධයි",
      disconnectedGrid: "විදුලි සැපයුම විසන්ධි වී ඇත",
      daysUnit: "දින",
      perDayUnit: "/ දිනකට",
      savingTipTitle: "විදුලි ඉතිරි කිරීමේ උපදෙසක්",
      savingTipDesc: "රාත්‍රී 6:30 සිට 10:30 දක්වා උපරිම විදුලි ගාස්තු අයවන බැවින්, වැඩි විදුලියක් වැයවන උපකරණ භාවිතය සීමා කිරීමෙන් බිල්පත අඩු කරගත හැක.",
      quickActions: "ක්ෂණික සේවා",
    },
    addMeter: {
      title: "නව ස්මාර්ට් මීටරයක් එක් කරන්න",
      subtitle: "විදුලි පරිභෝජනය පරීක්ෂා කිරීමට සහ රීචාර්ජ් කිරීමට ඔබගේ ගිණුමට ලෙකෝ මීටරය සම්බන්ධ කරන්න.",
      meterNumberLabel: "මීටර් අංකය",
      meterNumberPlaceholder: "උදා: 123456789",
      accountNumberLabel: "ලෙකෝ ගිණුම් අංකය",
      accountNumberPlaceholder: "උදා: 1234567890",
      pinLabel: "මීටරයේ PIN අංකය / මුරපදය",
      pinPlaceholder: "******",
      verifyBtn: "මීටරය පරීක්ෂා කරන්න",
      meterFound: "මීටරය සොයාගන්නා ලදී",
      verificationSuccess: "තහවුරු කිරීම සාර්ථකයි",
      locationLabel: "ස්ථානය",
      connectionLabel: "සම්බන්ධතාවය",
      activeStatus: "සක්‍රීයයි",
      tariffLabel: "ගාස්තු ක්‍රමය",
      domesticTariff: "ගෘහස්ථ",
      cancelBtn: "අවලංගු කරන්න",
      addMeterBtn: "මීටරය එක් කරන්න",
      meterAddedSuccess: "මීටරය සාර්ථකව සම්බන්ධ කරන ලදී!",
      meterLinkedDesc: "අංකය සහිත මීටරය ඔබගේ ගිණුමට සාර්ථකව එකතු විය.",
      addAnotherMeter: "තවත් මීටරයක් එක් කරන්න",
      viewInOverview: "දළ විශ්ලේෂණයේ බලන්න",
      errorAddingMeter: "මීටරය එක් කිරීමේදී දෝෂයක් ඇති විය",
      tryAgain: "නැවත උත්සාහ කරන්න",
      myLinkedMeters: "මගේ සම්බන්ධිත මීටර",
      manageMetersDesc: "ඔබගේ ගිණුමට සම්බන්ධ සියලුම මීටර කළමනාකරණය කරන්න",
      activeDefault: "ප්‍රධාන මීටරය",
      noMetersYet: "තවමත් මීටර කිසිවක් සම්බන්ධ කර නොමැත.",
      balancePrefix: "ශේෂය",
    },
    payments: {
      title: "පෙරගෙවුම් මීටරය රීචාර්ජ් කිරීම",
      subtitle: "කාඩ්පත්, ඔන්ලයින් බැංකු හෝ ක්ෂණික ක්‍රම මඟින් ඔබගේ මීටරය ක්ෂණිකව රීචාර්ජ් කරගන්න.",
      noMeterTitle: "සම්බන්ධිත මීටරයක් නොමැත",
      noMeterDesc: "රීචාර්ජ් කිරීමට පෙර ඔබගේ ස්මාර්ට් මීටරය සම්බන්ධ කළ යුතුය. පළමුව 'මීටරයක් එක් කරන්න' වෙත යන්න.",
      targetMeter: "අදාළ ස්මාර්ට් මීටරය",
      currentBalance: "වත්මන් ශේෂය",
      debtNoticeTitle: "හදිසි ණය මුදල පියවීම",
      debtNoticeDesc: "මෙම මීටරය සඳහා ලබාගත් හදිසි ණයක් පවතී. ඔබ රීචාර්ජ් කරන මුදලින් පළමුව එම ණය මුදල ස්වයංක්‍රීයව පියවනු ලැබේ.",
      selectMeterLabel: "රීචාර්ජ් කිරීමට මීටරය තෝරන්න",
      chooseAmount: "රීචාර්ජ් මුදල තෝරන්න",
      orCustomAmount: "හෝ කැමති මුදලක් ඇතුළත් කරන්න",
      customPlaceholder: "උදා: 1500",
      continueBtn: "ගෙවීම සඳහා ඉදිරියට යන්න",
      totalToPay: "ගෙවිය යුතු සම්පූර්ණ මුදල",
      paymentMethod: "ගෙවීම් ක්‍රමය",
      methodPayhere: "PayHere ඔන්ලයින් ගේට්වේ (වීසා, මාස්ටර්, Amex, eZ Cash, mCash, Genie, විශ්ව)",
      methodCard: "වීසා / මාස්ටර් කාඩ්පත් (Credit / Debit Card)",
      methodWallet: "ජංගම මුදල් පසුම්බිය / ලංකා QR",
      methodBank: "ඔන්ලයින් බැංකු මාරුවීම්",
      payhereNotice: "ශ්‍රී ලංකා මහ බැංකුව අනුමත PayHere ජාතික ගෙවීම් පද්ධතිය මඟින් ආරක්ෂිතයි",
      payhereSecureBadge: "PayHere 256-Bit SSL සුරක්ෂිතයි",
      backBtn: "ආපසු",
      confirmAndPay: "තහවුරු කර ගෙවන්න",
      creditingTitle: "මීටරයට මුදල් බැරවෙමින් පවතී...",
      creditingDesc: "ගෙවීම් පද්ධතිය හා සම්බන්ධ වෙමින් පවතී. කරුණාකර රැඳී සිටින්න.",
      successTitle: "රීචාර්ජ් කිරීම සාර්ථකයි!",
      successDesc: "ඔබගේ ස්මාර්ට් මීටරයට මුදල් ක්ෂණිකව බැර කරන ලදී.",
      viewReceiptHistory: "රිසිට්පත සහ ඉතිහාසය බලන්න",
      backToOverview: "දළ විශ්ලේෂණයට යන්න",
      paymentFailed: "ගෙවීම අසාර්ථක විය",
      networkError: "සම්බන්ධතා දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න.",
    },
    history: {
      title: "ගෙවීම් ඉතිහාසය",
      subtitle: "ඔබ සිදුකළ සියලුම රීචාර්ජ් ගෙවීම් සහ නිල ඊ-රිසිට්පත් මෙතැනින් ලබාගන්න.",
      filterAll: "සියලුම ක්‍රම",
      filterCard: "කාඩ්පත්",
      filterWallet: "QR / Wallet",
      filterBank: "බැංකු මාරුවීම්",
      searchPlaceholder: "ගනුදෙනු අංකය හෝ මීටර් අංකය මඟින් සොයන්න...",
      totalTransactions: "මුළු ගනුදෙනු ගණන",
      totalSpent: "මුළු රීචාර්ජ් කළ මුදල",
      successfulRecharges: "සාර්ථක ගෙවීම්",
      dateCol: "දිනය සහ වේලාව",
      referenceCol: "ගනුදෙනු අංකය (ID)",
      meterCol: "මීටර් අංකය",
      amountCol: "මුදල",
      methodCol: "ගෙවීම් ක්‍රමය",
      statusCol: "තත්ත්වය",
      receiptCol: "රිසිට්පත",
      viewReceipt: "රිසිට්පත බලන්න",
      noRecords: "ගෙවීම් වාර්තා නොමැත",
      noRecordsDesc: "ඔබ තවමත් රීචාර්ජ් කිරීමක් සිදුකර නොමැත, නැතහොත් සෙවූ තොරතුරු හමු නොවීය.",
      completed: "සාර්ථකයි",
      pending: "සිදුවෙමින් පවතී",
      failed: "අසාර්ථකයි",
      receiptModalTitle: "රීචාර්ජ් රිසිට්පත",
      officialReceipt: "ලෙකෝ ස්මාර්ට් මීටර් නිල ඊ-රිසිට්පත",
      transactionId: "ගනුදෙනු අංකය",
      paymentDate: "ගෙවූ දිනය",
      meterNumber: "මීටර් අංකය",
      previousBalance: "පෙර ශේෂය",
      newBalance: "නව යාවත්කාලීන ශේෂය",
      closeBtn: "රිසිට්පත වසන්න",
    },
    complaints: {
      title: "පැමිණිලි සහ සහාය සේවාව",
      subtitle: "විදුලිය විසන්ධි වීම්, මීටර දෝෂ හෝ බිල්පත් ගැටලු සෘජුවම ලෙකෝ කාර්මික අංශයට දන්වන්න.",
      newComplaint: "නව පැමිණිල්ලක් යොමු කරන්න",
      myComplaints: "මගේ පැමිණිලි ලැයිස්තුව",
      selectCategory: "පැමිණිලි වර්ගය",
      priorityLabel: "ප්‍රමුඛතාවය",
      subjectLabel: "මාතෘකාව",
      subjectPlaceholder: "ගැටලුව පිළිබඳ කෙටි හැඳින්වීමක්...",
      descriptionLabel: "විස්තරය",
      descriptionPlaceholder: "සිදුවූ දේ පිළිබඳ පැහැදිලි විස්තරයක් ඇතුළත් කරන්න...",
      meterOptional: "අදාළ මීටරය (අවශ්‍ය නම්)",
      selectMeter: "මීටරය තෝරන්න",
      submitBtn: "පැමිණිල්ල යොමු කරන්න",
      submitting: "යොමු කරමින් පවතී...",
      filterAll: "සියල්ල",
      filterActive: "විමර්ශනය වෙමින් පවතින",
      filterResolved: "විසඳූ ඒවා",
      searchPlaceholder: "පැමිණිලි අංකය, මාතෘකාව හෝ මීටරය මඟින් සොයන්න...",
      noComplaints: "පැමිණිලි කිසිවක් හමු නොවීය.",
      ticketNumber: "පැමිණිලි අංකය",
      statusLabel: "තත්ත්වය",
      queued: "පෝලිමේ ඇත",
      inReview: "පරීක්ෂා කරමින් පවතී",
      investigating: "ක්ෂේත්‍ර විමර්ශනයේ",
      resolved: "විසඳා ඇත",
      closed: "අවසන් කර ඇත",
      priorityLow: "සාමාන්‍ය ප්‍රමුඛතාවය",
      priorityMedium: "මධ්‍යම ප්‍රමුඛතාවය",
      priorityHigh: "ඉහළ ප්‍රමුඛතාවය",
      priorityEmergency: "හදිසි බිඳවැටීමක්",
      typeRechargeProblem: "රීචාර්ජ් / ටෝකන් ගැටලුවක්",
      typeIncorrectBalance: "ශේෂය නිවැරදි නොවීම",
      typeMeterFault: "මීටරයේ දෝෂයක්",
      typePowerInterruption: "විදුලිය ඇනහිටීමක්",
      typeHighConsumption: "අසාමාන්‍ය ලෙස ඒකක වැයවීමක්",
      typeVoltageFluctuation: "වෝල්ටීයතා උච්චාවචනයක්",
      typeConnectionProblem: "මීටර සම්බන්ධතා ගැටලුවක්",
      typeOther: "වෙනත් සහාය ඉල්ලීමක්",
      feedbackSubmitted: "ඔබගේ පැමිණිල්ල ලෙකෝ ඉංජිනේරු අංශය වෙත සාර්ථකව යොමු කරන ලදී.",
    },
    settings: {
      title: "ගිණුම සහ බලශක්ති සැකසුම්",
      subtitle: "ඔබගේ ගිණුම් තොරතුරු, භාෂාව, දැනුම්දීම් සහ ආරක්ෂක සැකසුම් මෙතැනින් පාලනය කරන්න.",
      tabAlerts: "ශේෂ දැනුම්දීම්",
      tabNotifications: "දැනුම්දීම් ක්‍රම",
      tabSecurity: "ආරක්ෂාව",
      accountProfile: "පාරිභෝගික ගිණුම",
      emailLabel: "විද්‍යුත් තැපෑල (Email)",
      phoneLabel: "ජංගම දුරකථන අංකය",
      roleLabel: "ගිණුම් වර්ගය",
      customerRole: "පෙරගෙවුම් පාරිභෝගික",
      energyPreferences: "ස්මාර්ට් පරිභෝජන සැකසුම්",
      monthlyBudget: "ඉලක්කගත මාසික අයවැය (රු.)",
      lowBalanceThreshold: "අඩු ශේෂ අනතුරු ඇඟවීමේ සීමාව (රු.)",
      dailyBudget: "දෛනික ඉලක්කගත ඒකක ප්‍රමාණය (kWh)",
      autoEmergencyCredit: "හදිසි ණය ස්වයංක්‍රීයව සක්‍රීය කිරීම",
      autoEmergencyCreditDesc: "රාත්‍රී කාලයේදී ශේෂය අවසන් වූ විට ස්වයංක්‍රීයව හදිසි ණය පහසුකම ලබාගන්න.",
      nightCurfew: "රාත්‍රී කාලයේ විදුලිය ආරක්ෂා කිරීම",
      nightCurfewDesc: "රාත්‍රී 10:00 සිට පසුදා උදෑසන 06:00 දක්වා කිසිදු විටෙක විදුලිය විසන්ධි නොකරයි.",
      notificationChannels: "දැනුම්දීම් ලබන මාර්ග",
      smsNotifications: "SMS පණිවිඩ මඟින් ශේෂය සහ රීචාර්ජ් දැනුම්දීම්",
      smsNotificationsDesc: "ඔබගේ ජංගම දුරකථනයට ක්ෂණික කෙටි පණිවිඩ ලබාගන්න.",
      emailNotifications: "විද්‍යුත් තැපෑල මඟින් මාසික ප්‍රකාශන",
      emailNotificationsDesc: "මාසික පරිභෝජන වාර්තා විද්‍යුත් තැපෑලට ලබාගන්න.",
      weeklyDigest: "සතිපතා බලශක්ති සාරාංශය",
      weeklyDigestDesc: "විදුලිය ඉතිරි කරගැනීම පිළිබඳ සතිපතා වාර්තාවක් ලබාගන්න.",
      securitySettings: "ආරක්ෂාව සහ මුරපදය",
      changePassword: "මුරපදය වෙනස් කිරීම",
      currentPassword: "වත්මන් මුරපදය",
      newPassword: "නව මුරපදය",
      confirmPassword: "නව මුරපදය තහවුරු කරන්න",
      savePreferences: "සැකසුම් සුරකින්න",
      saving: "සුරකිමින් පවතී...",
      savedSuccess: "සැකසුම් සාර්ථකව සුරකින ලදී!",
      logoutBtn: "ගිණුමෙන් පිටවන්න",
      passwordsDoNotMatch: "නව මුරපද නොගැළපේ",
      passwordMinLength: "මුරපදය අවම වශයෙන් අක්ෂර 10ක් විය යුතුය",
      showPasswords: "මුරපදය පෙන්වන්න",
    },
    bot: {
      askAi: "LECO AI සහයක විමසන්න",
      title: "LECO බලශක්ති සහයක",
      agentBadge: "AI සහයක",
      statusOnline: "සම්බන්ධයි • සජීවී දත්ත ක්‍රියාත්මකයි",
      welcomeMessage: "ආයුබෝවන්! මම ඔබගේ **LECO ස්මාර්ට් බලශක්ති සහයක**.\n\nමට ඔබගේ සජීවී මීටර් දත්ත විශ්ලේෂණය කිරීමට, ඔබගේ ශේෂය තව දින කීයක් ප්‍රමාණවත්දැයි පරීක්ෂා කිරීමට, PUCSL ගාස්තු ක්‍රමය පැහැදිලි කිරීමට හෝ පෙර ගෙවීම් පරීක්ෂා කිරීමට හැකිය. අද මම ඔබට උදව් කරන්නේ කෙසේද?",
      promptDaysLeft: "ශේෂය තව දින කීයක් ප්‍රමාණවත්ද?",
      promptLastTopup: "මගේ අවසාන රීචාර්ජ් එක කුමක්ද?",
      promptCompareUsage: "සතිපතා විදුලි පරිභෝජනය සංසන්දනය කරන්න",
      promptLifelineActive: "හදිසි ණය (Lifeline) ක්‍රියාත්මකද?",
      inputPlaceholder: "ඉතිරි දින, ගාස්තු, පරිභෝජනය ගැන විමසන්න...",
      typingNotice: "බලශක්ති දත්ත පරීක්ෂා කරමින් පවතී...",
      networkError: "බලශක්ති පද්ධතියට සම්බන්ධ වීමේදී දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.",
      fallbackReply: "මෙම අවස්ථාවේදී ඔබගේ ඉල්ලීම සැකසීමට නොහැකි විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.",
    },
  },

  ta: {
    nav: {
      overview: "கண்ணோட்டம்",
      addMeter: "மீட்டரைச் சேர்க்கவும்",
      payments: "கட்டணங்கள் (ரீசார்ஜ்)",
      history: "கட்டண வரலாறு",
      complaints: "புகார்கள் & உதவி",
      settings: "அமைப்புகள்",
      logout: "வெளியேறு",
      navigationLabel: "முக்கிய மெனு",
    },
    dock: {
      overview: "விவரம்",
      recharge: "ரீசார்ஜ்",
      history: "வரலாறு",
      help: "உதவி",
      settings: "அமைப்புகள்",
    },
    header: {
      portalTitle: "LECO Self Care",
      eMeter: "LECO Self Care",
      notifications: "அறிவிப்புகள்",
      unread: "படிக்காதவை",
      noNotifications: "புதிய அறிவிப்புகள் எதுவும் இல்லை",
      markAllRead: "அனைத்தையும் படித்ததாகக் குறிக்கவும்",
      userRole: "வாடிக்கையாளர்",
    },
    errorBoundary: {
      title: "இந்த பகுதியை ஏற்றுவதில் பிழை ஏற்பட்டது",
      genericDesc: "இந்த பக்கத்தை காண்பிப்பதில் எதிர்பாராத பிழை ஏற்பட்டது.",
      reloadBtn: "மீண்டும் ஏற்றவும்",
    },
    overview: {
      title: "கண்ணோட்டம்",
      welcomeBack: "மீண்டும் நல்வரவு",
      availableBalance: "கிடைக்கக்கூடிய முன்பண நிலுவை",
      prepaidWallet: "முன்பண பணப்பை",
      lifelineActive: "அவசர கடன் செயலில் உள்ளது",
      currentTariff: "PUCSL கட்டண முறை",
      depositedCreditNotice: "வைப்புத்தொகை • மாத இறுதி கணக்கீடு வரை கழிக்கப்படாது",
      daysRemaining: "நாட்கள் மீதமுள்ளன",
      daysRemainingBuffer: "நாட்கள் (அவசர கடன் மூலம்)",
      calculating: "கணக்கிடப்படுகிறது...",
      projectedNetAfterSettlement: "கணக்கு தீர்க்கப்பட்ட பின் மீதமுள்ள தொகை",
      currentMonthAccruedBill: "இந்த மாதத்திற்கான இதுவரை கட்டணம்",
      pucslTariff: "PUCSL கட்டணம்",
      energyCharge: "மின் கட்டணம்",
      fixedCharge: "மாதாந்திர நிலையான கட்டணம்",
      tariffGroup: "கட்டணப் பிரிவு",
      rechargeNow: "இப்போது ரீசார்ஜ் செய்யவும்",
      settleCycle: "கணக்கை தீர்க்கவும்",
      meterStatus: "மீட்டர் நிலை",
      connection: "இணைப்பு",
      tariffPlan: "கட்டணத் திட்டம்",
      domesticBlock: "வீட்டுப் பிரிவு",
      meterNo: "மீட்டர் எண்",
      accountNo: "கணக்கு எண்",
      billingCycle: "30 நாள் சுழற்சி",
      pucslStandard: "PUCSL தரம்",
      electricityConsumption: "மின்சாரப் பயன்பாடு",
      todayNet: "இன்று — நிகர பயன்பாடு (உள் − வெளி)",
      thisWeekNet: "இந்த வாரம் — நிகர பயன்பாடு (உள் − வெளி)",
      livePowerNet: "நேரடி திறன் — நிகரம் (உள் − வெளி)",
      inFlow: "பயன்பாடு",
      outFlow: "வெளியீடு",
      usageComparison: "பயன்பாட்டு ஒப்பீடு (முந்தைய காலத்துடன்)",
      todayVsYesterday: "இன்று மற்றும் நேற்று ஒப்பீடு",
      thisWeekVsLastWeek: "இந்த வாரம் மற்றும் கடந்த வாரம் ஒப்பீடு",
      tariffLifetimePrediction: "மீதமுள்ள நாட்களின் கணிப்பு",
      confidence: "நம்பகத்தன்மை",
      highConfidence: "உயர்",
      mediumConfidence: "நடுத்தர",
      simulationNotice: "இலங்கை பொதுப் பயன்பாடுகள் ஆணைக்குழுவின் (PUCSL) அதிகாரப்பூர்வ கட்டண முறைப்படி கணக்கிடப்பட்டது",
      expectedRange: "எதிர்பார்க்கப்படும் நாட்கள் எல்லை",
      emergencyCreditActiveTitle: "அவசர கடன் செயலில் உள்ளது (Lifeline Mode)",
      powerProtected: "மின்சாரம் துண்டிக்கப்படாது",
      emergencyCreditActiveDesc: "உங்கள் மின் இணைப்பு தொடர்கிறது. அவசர காலங்களில் மின் துண்டிப்பைத் தடுக்க அவசர கடன் உதவுகிறது.",
      bufferUsed: "பயன்படுத்திய கடன்",
      bufferLeft: "மீதமுள்ள கடன்",
      rechargeClearDebt: "ரீசார்ஜ் செய்து கடனைத் தீர்க்கவும்",
      emergencyCreditAvailableTitle: "அவசர கடன் வசதி உள்ளது",
      lifelineProtection: "மின்சாரப் பாதுகாப்பு",
      emergencyCreditAvailableDesc: "உங்கள் முன்பண நிலுவை குறைவாக உள்ளது. மின் துண்டிப்பைத் தவிர்க்க அவசர கடனைப் பயன்படுத்தவும்.",
      activateCredit: "கடனைப் பெறவும்",
      activating: "செயல்படுத்தப்படுகிறது...",
      simulatorTitle: "நேரடி மீட்டர் மாதிரி (Simulator)",
      testSandbox: "சோதனை முறைமை",
      simulatorDesc: "மின் அலகுகளின் பயன்பாட்டை உருவகப்படுத்தி PUCSL கட்டணங்கள் மற்றும் மீதமுள்ள நாட்களைப் பார்க்கவும்.",
      hide: "மறைக்கவும்",
      expand: "விரிவாக்கவும்",
      usage: "பயன்பாடு",
      clear: "அழிக்கவும்",
      budgetSectionTitle: "மாதாந்திர வரவுசெலவு & எச்சரிக்கை அமைப்புகள்",
      monthlyBudgetTitle: "மாதாந்திர மின்சார வரவுசெலவு",
      dailyBudgetTitle: "இலக்கு தினசரி பயன்பாடு",
      lowBalanceNotificationTitle: "குறைந்த நிலுவை எச்சரிக்கை",
      adjustBudgetBtn: "வரவுசெலவு & எச்சரிக்கைகளை மாற்றுக",
      spentOf: "செலவிடப்பட்டது (மொத்தத்தில்)",
      remainingOf: "மீதமுள்ளது",
      simplifiedView: "எளிய பார்வை",
      detailedView: "விரிவான பார்வை",
      simplifiedViewDesc: "வீட்டின் அன்றாட பயன்பாட்டிற்கு ஏற்ற தெளிவான எளிய இடைமுகம்",
      supplyDaysTitle: "மின்சாரம் நீடிக்கும் மதிப்பிடப்பட்ட நாட்கள்",
      supplyDaysSubtext: "மின்சாரம் நீடிக்கும் என எதிர்பார்க்கப்படும் தேதி",
      dailyEstimateTitle: "மதிப்பிடப்பட்ட தினசரி செலவு",
      dailyEstimateSubtext: "சராசரி தினசரி மின்சாரச் செலவு",
      actualUsage: "உண்மையான பயன்பாடு",
      predictedUsage: "கணிக்கப்பட்ட பயன்பாடு",
      todayUsageTitle: "இன்றைய மின் பயன்பாடு",
      activeLoadTitle: "தற்போதைய மின் திறன்",
      connectedGrid: "மின் கட்டமைப்புடன் இணைக்கப்பட்டுள்ளது",
      disconnectedGrid: "மின் இணைப்பு துண்டிக்கப்பட்டுள்ளது",
      daysUnit: "நாட்கள்",
      perDayUnit: "/ நாள்",
      savingTipTitle: "மின் சேமிப்பு குறிப்பு",
      savingTipDesc: "இரவு 6:30 முதல் 10:30 வரையிலான உச்ச கட்டண நேரங்களில் அதிக மின்சாரம் பயன்படுத்தும் சாதனங்களைக் குறைப்பதன் மூலம் மாதாந்திரக் கட்டணத்தைக் குறைக்கலாம்.",
      quickActions: "விரைவு சேவைகள்",
    },
    addMeter: {
      title: "புதிய ஸ்மார்ட் மீட்டரைச் சேர்க்கவும்",
      subtitle: "பயன்பாட்டைக் கண்காணிக்கவும் ரீசார்ஜ் செய்யவும் உங்கள் கணக்கில் லெகோ மீட்டரை இணைக்கவும்.",
      meterNumberLabel: "மீட்டர் எண்",
      meterNumberPlaceholder: "எ.கா: 123456789",
      accountNumberLabel: "லெகோ கணக்கு எண்",
      accountNumberPlaceholder: "எ.கா: 1234567890",
      pinLabel: "மீட்டர் PIN / கடவுச்சொல்",
      pinPlaceholder: "******",
      verifyBtn: "மீட்டரைச் சரிபார்க்கவும்",
      meterFound: "மீட்டர் கண்டுபிடிக்கப்பட்டது",
      verificationSuccess: "சரிபார்ப்பு வெற்றிகரமானது",
      locationLabel: "இடம்",
      connectionLabel: "இணைப்பு",
      activeStatus: "செயலில் உள்ளது",
      tariffLabel: "கட்டண முறை",
      domesticTariff: "வீட்டுப் பயன்பாடு",
      cancelBtn: "ரத்து செய்",
      addMeterBtn: "மீட்டரைச் சேர்க்கவும்",
      meterAddedSuccess: "மீட்டர் வெற்றிகரமாக இணைக்கப்பட்டது!",
      meterLinkedDesc: "எண் கொண்ட மீட்டர் உங்கள் கணக்குடன் இணைக்கப்பட்டது.",
      addAnotherMeter: "மற்றொரு மீட்டரைச் சேர்க்கவும்",
      viewInOverview: "கண்ணோட்டத்தில் பார்க்கவும்",
      errorAddingMeter: "மீட்டரைச் சேர்ப்பதில் பிழை ஏற்பட்டது",
      tryAgain: "மீண்டும் முயற்சிக்கவும்",
      myLinkedMeters: "எனது இணைக்கப்பட்ட மீட்டர்கள்",
      manageMetersDesc: "உங்கள் கணக்குடன் இணைக்கப்பட்ட அனைத்து மீட்டர்களையும் நிர்வகிக்கவும்",
      activeDefault: "முக்கிய மீட்டர்",
      noMetersYet: "இதுவரை எந்த மீட்டரும் இணைக்கப்படவில்லை.",
      balancePrefix: "நிலுவை",
    },
    payments: {
      title: "முன்பண மீட்டரை ரீசார்ஜ் செய்யவும்",
      subtitle: "அட்டை, இணைய வங்கி அல்லது QR மூலம் உங்கள் மீட்டருக்கு உடனடி ரீசார்ஜ் செய்யுங்கள்.",
      noMeterTitle: "மீட்டர் எதுவும் இணைக்கப்படவில்லை",
      noMeterDesc: "ரீசார்ஜ் செய்ய முதலில் உங்கள் ஸ்மார்ட் மீட்டரை இணைக்க வேண்டும். முதலில் 'மீட்டரைச் சேர்க்கவும்' பகுதிக்குச் செல்லவும்.",
      targetMeter: "குறிப்பிட்ட ஸ்மார்ட் மீட்டர்",
      currentBalance: "தற்போதைய நிலுவை",
      debtNoticeTitle: "அவசர கடன் மீட்பு",
      debtNoticeDesc: "இந்த மீட்டரில் பெறப்பட்ட அவசர கடன் நிலுவையில் உள்ளது. நீங்கள் ரீசார்ஜ் செய்யும் தொகையில் முதலில் இந்த கடன் தானாகவே கழிக்கப்படும்.",
      selectMeterLabel: "ரீசார்ஜ் செய்ய வேண்டிய மீட்டரைத் தேர்ந்தெடுக்கவும்",
      chooseAmount: "ரீசார்ஜ் தொகையைத் தேர்ந்தெடுக்கவும்",
      orCustomAmount: "அல்லது விரும்பிய தொகையை உள்ளிடவும்",
      customPlaceholder: "எ.கா: 1500",
      continueBtn: "கட்டணத்திற்குச் செல்லவும்",
      totalToPay: "செலுத்த வேண்டிய மொத்தத் தொகை",
      paymentMethod: "கட்டண முறை",
      methodPayhere: "PayHere இணைய நுழைவாயில் (Visa, Master, Amex, eZ Cash, mCash, Genie, Vishwa)",
      methodCard: "கிரெடிட் / டெபிட் கார்டு (Visa, Mastercard)",
      methodWallet: "மொபைல் பணப்பை / லங்கா QR",
      methodBank: "இணைய வங்கி பரிமாற்றம்",
      payhereNotice: "இலங்கை மத்திய வங்கி அங்கீகரித்த PayHere தேசிய கட்டண முறைமையால் பாதுகாக்கப்பட்டது",
      payhereSecureBadge: "PayHere 256-Bit SSL பாதுகாப்பானது",
      backBtn: "பின்செல்லவும்",
      confirmAndPay: "உறுதிப்படுத்தி செலுத்தவும்",
      creditingTitle: "மீட்டருக்கு தொகை வரவு வைக்கப்படுகிறது...",
      creditingDesc: "கட்டண நுழைவாயிலுடன் இணைக்கப்படுகிறது. சிறிது நேரம் காத்திருக்கவும்.",
      successTitle: "ரீசார்ஜ் வெற்றிகரமாக முடிந்தது!",
      successDesc: "உங்கள் ஸ்மார்ட் மீட்டருக்கு தொகை உடனடியாக வரவு வைக்கப்பட்டது.",
      viewReceiptHistory: "ரசீது & வரலாற்றைப் பார்க்கவும்",
      backToOverview: "கண்ணோட்டத்திற்குச் செல்லவும்",
      paymentFailed: "கட்டணம் செலுத்த முடியவில்லை",
      networkError: "இணைப்புப் பிழை. மீண்டும் முயற்சிக்கவும்.",
    },
    history: {
      title: "கட்டண வரலாறு",
      subtitle: "உங்கள் அனைத்து முந்தைய ரீசார்ஜ்கள் மற்றும் மின்-ரசீதுகளை இங்கே பார்க்கலாம் மற்றும் பதிவிறக்கலாம்.",
      filterAll: "அனைத்து முறைகளும்",
      filterCard: "அட்டை",
      filterWallet: "QR / Wallet",
      filterBank: "வங்கி பரிமாற்றம்",
      searchPlaceholder: "பரிவர்த்தனை எண் அல்லது மீட்டர் எண் மூலம் தேடவும்...",
      totalTransactions: "மொத்த பரிவர்த்தனைகள்",
      totalSpent: "மொத்த ரீசார்ஜ் தொகை",
      successfulRecharges: "வெற்றிகரமானவை",
      dateCol: "தேதி மற்றும் நேரம்",
      referenceCol: "பரிவர்த்தனை எண் (ID)",
      meterCol: "மீட்டர் எண்",
      amountCol: "தொகை",
      methodCol: "கட்டண முறை",
      statusCol: "நிலை",
      receiptCol: "ரசீது",
      viewReceipt: "ரசீதைப் பார்க்கவும்",
      noRecords: "பரிவர்த்தனை பதிவுகள் எதுவும் இல்லை",
      noRecordsDesc: "நீங்கள் இதுவரை ரீசார்ஜ் செய்யவில்லை அல்லது உங்கள் தேடலுக்குரிய பதிவுகள் கிடைக்கவில்லை.",
      completed: "வெற்றி",
      pending: "செயல்பாட்டில் உள்ளது",
      failed: "தோல்வி",
      receiptModalTitle: "ரீசார்ஜ் ரசீது",
      officialReceipt: "லெகோ ஸ்மார்ட் மீட்டர் அதிகாரப்பூர்வ மின்-ரசீது",
      transactionId: "பரிவர்த்தனை எண்",
      paymentDate: "கட்டணத் தேதி",
      meterNumber: "மீட்டர் எண்",
      previousBalance: "முந்தைய நிலுவை",
      newBalance: "புதுப்பிக்கப்பட்ட நிலுவை",
      closeBtn: "ரசீதை மூடவும்",
    },
    complaints: {
      title: "புகார்கள் & உதவி மையம்",
      subtitle: "மின் தடை, மீட்டர் கோளாறு அல்லது கட்டணப் பிரச்சனைகளை நேரடியாக லெகோ பொறியியல் பிரிவுக்கு தெரிவிக்கவும்.",
      newComplaint: "புதிய புகாரை சமர்ப்பிக்கவும்",
      myComplaints: "எனது புகார்கள்",
      selectCategory: "புகாரின் வகை",
      priorityLabel: "முன்னுரிமை",
      subjectLabel: "தலைப்பு",
      subjectPlaceholder: "பிரச்சனை குறித்த சுருக்கம்...",
      descriptionLabel: "விளக்கம்",
      descriptionPlaceholder: "பிரச்சனையை விரிவாக விவரிக்கவும்...",
      meterOptional: "தொடர்புடைய மீட்டர் (தேவைப்பட்டால்)",
      selectMeter: "மீட்டரைத் தேர்ந்தெடுக்கவும்",
      submitBtn: "புகாரை சமர்ப்பிக்கவும்",
      submitting: "சமர்ப்பிக்கப்படுகிறது...",
      filterAll: "அனைத்தும்",
      filterActive: "செயலில் உள்ளவை",
      filterResolved: "தீர்க்கப்பட்டவை",
      searchPlaceholder: "புகார் எண், தலைப்பு அல்லது மீட்டர் மூலம் தேடவும்...",
      noComplaints: "புகார்கள் எதுவும் கிடைக்கவில்லை.",
      ticketNumber: "புகார் எண்",
      statusLabel: "நிலை",
      queued: "வரிசையில் உள்ளது",
      inReview: "ஆய்வில் உள்ளது",
      investigating: "கள ஆய்வில் உள்ளது",
      resolved: "தீர்க்கப்பட்டது",
      closed: "முடிக்கப்பட்டது",
      priorityLow: "குறைந்த முன்னுரிமை",
      priorityMedium: "நடுத்தர முன்னுரிமை",
      priorityHigh: "உயர் முன்னுரிமை",
      priorityEmergency: "அவசர முறிவு",
      typeRechargeProblem: "ரீசார்ஜ் / டோக்கன் பிரச்சனை",
      typeIncorrectBalance: "நிலுவைத் தொகையில் பிழை",
      typeMeterFault: "மீட்டர் வன்பொருள் கோளாறு",
      typePowerInterruption: "மின் தடை / மின் இழப்பு",
      typeHighConsumption: "அசாதாரண பயன்பாட்டு அதிகரிப்பு",
      typeVoltageFluctuation: "மின்னழுத்த ஏற்ற இறக்கம்",
      typeConnectionProblem: "மீட்டர் இணைப்புப் பிரச்சனை",
      typeOther: "மற்றொரு உதவி கோரிக்கை",
      feedbackSubmitted: "உங்கள் புகார் லெகோ பொறியியல் பிரிவுக்கு வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.",
    },
    settings: {
      title: "கணக்கு & ஆற்றல் அமைப்புகள்",
      subtitle: "உங்கள் சுயவிவரம், மொழி, எச்சரிக்கைகள் மற்றும் கணக்கு பாதுகாப்பை நிர்வகிக்கவும்.",
      tabAlerts: "ஆற்றல் எச்சரிக்கைகள்",
      tabNotifications: "அறிவிப்பு முறைகள்",
      tabSecurity: "பாதுகாப்பு",
      accountProfile: "வாடிக்கையாளர் சுயவிவரம்",
      emailLabel: "மின்னஞ்சல் முகவரி",
      phoneLabel: "மொபைல் எண்",
      roleLabel: "கணக்கு வகை",
      customerRole: "முன்பண வாடிக்கையாளர்",
      energyPreferences: "ஸ்மார்ட் ஆற்றல் விருப்பத்தேர்வுகள்",
      monthlyBudget: "இலக்கு மாதாந்திர வரவுசெலவு (ரூ.)",
      lowBalanceThreshold: "குறைந்த நிலுவை எச்சரிக்கை வரம்பு (ரூ.)",
      dailyBudget: "இலக்கு தினசரி பயன்பாடு (kWh)",
      autoEmergencyCredit: "தானியங்கி அவசர கடன் செயல்படுத்தல்",
      autoEmergencyCreditDesc: "இரவில் நிலுவை பூஜ்ஜியமாகும் போது தானாகவே அவசர கடனை இயக்கவும்.",
      nightCurfew: "இரவு நேர மின் பாதுகாப்பு",
      nightCurfewDesc: "இரவு 10:00 மணி முதல் காலை 06:00 மணி வரை மின்சாரத்தை துண்டிக்க வேண்டாம்.",
      notificationChannels: "அறிவிப்பு வழிகள்",
      smsNotifications: "SMS மூலம் நிலுவை மற்றும் ரீசார்ஜ் எச்சரிக்கைகள்",
      smsNotificationsDesc: "உங்கள் மொபைலுக்கு உடனடி SMS அறிவிப்புகளைப் பெறவும்.",
      emailNotifications: "மின்னஞ்சல் மூலம் மாதாந்திர அறிக்கைகள்",
      emailNotificationsDesc: "மாதாந்திர பயன்பாட்டு விபரங்களை மின்னஞ்சலில் பெறவும்.",
      weeklyDigest: "வாராந்திர ஆற்றல் சுருக்கம்",
      weeklyDigestDesc: "மின்சார சேமிப்பு குறித்த வாராந்திர ஒப்பீட்டு அறிக்கை.",
      securitySettings: "பாதுகாப்பு & கடவுச்சொல்",
      changePassword: "கடவுச்சொல்லை மாற்றவும்",
      currentPassword: "தற்போதைய கடவுச்சொல்",
      newPassword: "புதிய கடவுச்சொல்",
      confirmPassword: "புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்",
      savePreferences: "அமைப்புகளைச் சேமிக்கவும்",
      saving: "சேமிக்கப்படுகிறது...",
      savedSuccess: "அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன!",
      logoutBtn: "வெளியேறு",
      passwordsDoNotMatch: "புதிய கடவுச்சொற்கள் பொருந்தவில்லை",
      passwordMinLength: "கடவுச்சொல் குறைந்தபட்சம் 10 எழுத்துகளாக இருக்க வேண்டும்",
      showPasswords: "கடவுச்சொற்களைக் காட்டு",
    },
    bot: {
      askAi: "LECO AI உதவியாளரிடம் கேட்கவும்",
      title: "LECO மின்சார உதவியாளர்",
      agentBadge: "AI முகவர்",
      statusOnline: "இணைக்கப்பட்டுள்ளது • நேரடி அளவீடு செயலில்",
      welcomeMessage: "வணக்கம்! நான் உங்கள் **LECO ஸ்மார்ட் மின்சார உதவியாளர்**.\n\nஉங்கள் நேரடி மீட்டர் தகவல்களை பகுப்பாய்வு செய்யவும், உங்கள் மீதித் தொகை எத்தனை நாட்களுக்கு போதுமானது என அறியவும், PUCSL கட்டண அடுக்குகளை புரிந்துகொள்ளவும் அல்லது முந்தைய ரீசார்ஜ்களை சரிபார்க்கவும் எனக்கு இயலும். இன்று நான் உங்களுக்கு எவ்வாறு உதவலாம்?",
      promptDaysLeft: "எனது மீதித் தொகை எத்தனை நாட்களுக்கு நீடிக்கும்?",
      promptLastTopup: "எனது கடைசி ரீசார்ஜ் விவரம் என்ன?",
      promptCompareUsage: "வாராந்திர மின் நுகர்வை ஒப்பிடுக",
      promptLifelineActive: "அவசர கடன் (Lifeline) முறையில் உள்ளதா?",
      inputPlaceholder: "மீதமுள்ள நாட்கள், கட்டணங்கள், பயன்பாடு பற்றி கேட்க...",
      typingNotice: "மின்சார தரவுகளை சரிபார்க்கிறது...",
      networkError: "மின்சார அமைப்புடன் இணைப்பதில் பிணைய பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
      fallbackReply: "தற்போது உங்கள் கோரிக்கையை செயல்படுத்த முடியவில்லை. சற்று நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
    },
  },
}

export function getDashboardTranslations(lang: DashboardLanguage): DashboardTranslations {
  return dashboardTranslations[lang] || dashboardTranslations.en
}

interface DashboardI18nContextType {
  language: DashboardLanguage
  setLanguage: (lang: DashboardLanguage) => void
  t: DashboardTranslations
}

const DashboardI18nContext = createContext<DashboardI18nContextType | undefined>(undefined)

export function DashboardI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DashboardLanguage>(() => {
    if (typeof window === "undefined") return "en"
    const saved = localStorage.getItem("customer_lang") as DashboardLanguage
    return saved === "si" || saved === "ta" || saved === "en" ? saved : "en"
  })

  const setLanguage = (newLang: DashboardLanguage) => {
    setLanguageState(newLang)
    if (typeof window !== "undefined") {
      localStorage.setItem("customer_lang", newLang)
    }
  }

  // Listen to external language changes if any
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "customer_lang" && e.newValue) {
        if (e.newValue === "si" || e.newValue === "ta" || e.newValue === "en") {
          setLanguageState(e.newValue as DashboardLanguage)
        }
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const t = getDashboardTranslations(language)

  return (
    <DashboardI18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </DashboardI18nContext.Provider>
  )
}

export function useDashboardI18n(): DashboardI18nContextType {
  const context = useContext(DashboardI18nContext)
  if (!context) {
    // Graceful fallback if rendered outside provider
    const fallbackLang: DashboardLanguage = 
      typeof window !== "undefined" 
        ? ((localStorage.getItem("customer_lang") as DashboardLanguage) || "en")
        : "en"
    const lang = fallbackLang === "si" || fallbackLang === "ta" || fallbackLang === "en" ? fallbackLang : "en"
    return {
      language: lang,
      setLanguage: (l) => {
        if (typeof window !== "undefined") localStorage.setItem("customer_lang", l)
      },
      t: getDashboardTranslations(lang)
    }
  }
  return context
}
