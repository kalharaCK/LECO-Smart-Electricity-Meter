const { calculateDomesticBill } = require('./tariffEngine');

/**
 * Predicts daily electricity consumption using explainable historical weighting.
 * Phase 1 Implementation from LECO Technical Guide:
 * recentAverage = 0.50 * last7DayAverage + 0.30 * last14DayAverage + 0.20 * last30DayAverage
 * predictedDailyKWh = 0.60 * recentAverage + 0.40 * sameWeekdayAverage
 *
 * @param {Array<{ date: string, consumption: number, dayOfWeek: number }>} dailyHistory - Array of daily kWh records (newest first)
 * @param {Date} targetDate - Date for which to predict consumption
 * @returns {{ predictedKWh: number, avgDailyKwh: number, confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' }}
 */
function predictDailyConsumption(dailyHistory, targetDate = new Date()) {
  if (!dailyHistory || dailyHistory.length === 0) {
    return { predictedKWh: 0, avgDailyKwh: 0, confidence: 'NONE' };
  }

  const validDays = dailyHistory.map(d => ({
    ...d,
    consumption: Math.max(0, Number(d.consumption) || 0),
    dayOfWeek: typeof d.dayOfWeek === 'number' ? d.dayOfWeek : new Date(d.date).getDay()
  }));

  const count = validDays.length;
  let confidence = 'LOW';
  if (count >= 30) confidence = 'HIGH';
  else if (count >= 7) confidence = 'MEDIUM';

  const targetDayOfWeek = targetDate.getDay();
  const sameWeekdayDays = validDays.filter(d => d.dayOfWeek === targetDayOfWeek);
  const sameWeekdayAvg = sameWeekdayDays.length > 0
    ? sameWeekdayDays.reduce((sum, d) => sum + d.consumption, 0) / sameWeekdayDays.length
    : null;

  // Average over first N days
  const getAverage = (n) => {
    const slice = validDays.slice(0, Math.min(n, validDays.length));
    if (slice.length === 0) return 0;
    return slice.reduce((sum, d) => sum + d.consumption, 0) / slice.length;
  };

  const avg7 = getAverage(7);
  const avg14 = getAverage(14);
  const avg30 = getAverage(30);

  let recentAverage = 0;
  if (count >= 30) {
    recentAverage = 0.50 * avg7 + 0.30 * avg14 + 0.20 * avg30;
  } else if (count >= 14) {
    recentAverage = 0.60 * avg7 + 0.40 * avg14;
  } else if (count >= 7) {
    recentAverage = avg7;
  } else {
    recentAverage = getAverage(count);
  }

  let predictedDailyKWh = 0;
  if (sameWeekdayAvg !== null && count >= 7) {
    predictedDailyKWh = 0.60 * recentAverage + 0.40 * sameWeekdayAvg;
  } else {
    predictedDailyKWh = recentAverage;
  }

  // Safety bounds
  predictedDailyKWh = Math.max(0.1, Math.round(predictedDailyKWh * 100) / 100);
  const overallAvg = getAverage(Math.min(30, count));

  return {
    predictedKWh: predictedDailyKWh,
    avgDailyKwh: Math.round(overallAvg * 100) / 100,
    confidence,
  };
}

/**
 * Simulates wallet lifetime day-by-day under the nonlinear domestic block tariff.
 *
 * @param {object} params
 * @param {number} params.walletBalance - Current prepaid wallet balance (LKR)
 * @param {number} params.currentCycleKWh - Cumulative kWh already used in the current 30-day billing cycle
 * @param {number} params.currentCycleDay - Day number into current cycle (1 to 30)
 * @param {Array} params.dailyHistory - Historic daily usage records
 * @param {number} [params.scenarioMultiplier=1.0] - Multiplier (0.85 for low usage, 1.00 for normal, 1.15 for high)
 * @returns {number} Estimated days
 */
function simulateWalletLifetime({
  walletBalance,
  currentCycleKWh = 0,
  currentCycleDay = 1,
  dailyHistory = [],
  scenarioMultiplier = 1.0,
}) {
  let balance = Number(walletBalance) || 0;
  if (balance <= 0) return 0;

  let cycleKWh = Math.max(0, Number(currentCycleKWh) || 0);
  let cycleDay = Math.max(1, Math.min(30, Number(currentCycleDay) || 1));
  let charged = calculateDomesticBill(cycleKWh).totalCharge;
  let simulatedDate = new Date();
  let days = 0;

  while (balance > 0 && days < 365) {
    // Check if crossing into a new 30-day billing cycle
    if (cycleDay > 30) {
      cycleKWh = 0;
      charged = 0;
      cycleDay = 1;
    }

    const nextDate = new Date(simulatedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const { predictedKWh } = predictDailyConsumption(dailyHistory, nextDate);
    const dayUsage = predictedKWh * scenarioMultiplier;
    const projectedKWh = cycleKWh + dayUsage;

    const newLiability = calculateDomesticBill(projectedKWh).totalCharge;
    const incrementalDebit = Math.max(0, newLiability - charged);

    if (balance <= incrementalDebit) {
      const fraction = incrementalDebit > 0 ? balance / incrementalDebit : 0;
      return Math.round((days + fraction) * 10) / 10;
    }

    balance -= incrementalDebit;
    cycleKWh = projectedKWh;
    charged = newLiability;
    cycleDay++;
    simulatedDate = nextDate;
    days++;
  }

  return days;
}

/**
 * High-level wallet prediction engine.
 * Computes estimated days remaining, min/max range, daily averages, and current tariff group.
 *
 * @param {object} params
 * @param {number} params.walletBalance
 * @param {number} params.currentCycleKWh
 * @param {number} params.currentCycleDay
 * @param {Array} params.dailyHistory
 */
function getWalletLifetimePrediction({
  walletBalance,
  currentCycleKWh = 0,
  currentCycleDay = 1,
  dailyHistory = [],
}) {
  const balance = Number(walletBalance) || 0;
  const cycleKWh = Number(currentCycleKWh) || 0;

  // Base prediction for tomorrow
  const { predictedKWh, avgDailyKwh, confidence } = predictDailyConsumption(dailyHistory, new Date());

  if (balance <= 0) {
    return {
      walletBalance: 0,
      estimatedDaysRemaining: 0,
      estimatedMinDays: 0,
      estimatedMaxDays: 0,
      averageDailyUsageKwh: avgDailyKwh,
      predictedTomorrowKwh: predictedKWh,
      billingCycleConsumptionKwh: cycleKWh,
      currentTariffGroup: calculateDomesticBill(cycleKWh).group,
      currentCycleLiability: calculateDomesticBill(cycleKWh).totalCharge,
      predictionConfidence: confidence,
      predictionMethod: "WEIGHTED_HISTORICAL",
      calculatedAt: new Date().toISOString(),
    };
  }

  // Simulate under three scenarios
  // Normal usage (1.00x)
  const normalDays = simulateWalletLifetime({
    walletBalance: balance,
    currentCycleKWh: cycleKWh,
    currentCycleDay,
    dailyHistory,
    scenarioMultiplier: 1.0,
  });

  // High usage (1.15x) -> yields shorter wallet lifetime (minDays)
  const minDays = simulateWalletLifetime({
    walletBalance: balance,
    currentCycleKWh: cycleKWh,
    currentCycleDay,
    dailyHistory,
    scenarioMultiplier: 1.15,
  });

  // Low usage (0.85x) -> yields longer wallet lifetime (maxDays)
  const maxDays = simulateWalletLifetime({
    walletBalance: balance,
    currentCycleKWh: cycleKWh,
    currentCycleDay,
    dailyHistory,
    scenarioMultiplier: 0.85,
  });

  const currentBill = calculateDomesticBill(cycleKWh);

  return {
    walletBalance: Math.round(balance * 100) / 100,
    estimatedDaysRemaining: Math.round(normalDays),
    estimatedMinDays: Math.max(0, Math.floor(minDays)),
    estimatedMaxDays: Math.max(Math.round(normalDays), Math.ceil(maxDays)),
    averageDailyUsageKwh: avgDailyKwh,
    predictedTomorrowKwh: predictedKWh,
    billingCycleConsumptionKwh: Math.round(cycleKWh * 100) / 100,
    currentTariffGroup: currentBill.group,
    currentCycleLiability: currentBill.totalCharge,
    predictionConfidence: confidence,
    predictionMethod: "WEIGHTED_HISTORICAL",
    calculatedAt: new Date().toISOString(),
  };
}

module.exports = {
  predictDailyConsumption,
  simulateWalletLifetime,
  getWalletLifetimePrediction,
};
