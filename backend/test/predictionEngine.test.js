const test = require('node:test');
const assert = require('node:assert/strict');
const {
  predictDailyConsumption,
  simulateWalletLifetime,
  getWalletLifetimePrediction,
} = require('../src/services/predictionEngine');

test('empty history returns no prediction', () => {
  assert.deepEqual(predictDailyConsumption([]), {
    predictedKWh: 0,
    avgDailyKwh: 0,
    confidence: 'NONE',
  });
});

test('seven days of history use the medium-confidence prediction', () => {
  const history = Array.from({ length: 7 }, (_, index) => ({
    date: `2025-01-${String(5 - index).padStart(2, '0')}`,
    consumption: 2,
    dayOfWeek: 1,
  }));
  const prediction = predictDailyConsumption(history, new Date('2025-01-06T12:00:00Z'));

  assert.equal(prediction.predictedKWh, 2);
  assert.equal(prediction.avgDailyKwh, 2);
  assert.equal(prediction.confidence, 'MEDIUM');
});

test('wallet simulation stops immediately when there is no balance', () => {
  assert.equal(simulateWalletLifetime({ walletBalance: 0 }), 0);
  assert.equal(simulateWalletLifetime({ walletBalance: -10 }), 0);
});

test('wallet prediction reports a bounded confidence and nonnegative estimate', () => {
  const prediction = getWalletLifetimePrediction({ walletBalance: 5000, dailyHistory: [] });
  assert.equal(prediction.predictionConfidence, 'NONE');
  assert.ok(prediction.estimatedDaysRemaining >= 0);
  assert.ok(prediction.estimatedMinDays <= prediction.estimatedMaxDays);
});
