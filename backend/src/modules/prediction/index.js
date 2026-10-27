const predictionRoutes = require('./predictionRoutes');
const predictionService = require('./predictionService');
const predictionController = require('./predictionController');

module.exports = {
  router: predictionRoutes,
  service: predictionService,
  controller: predictionController,
  // Direct function re-exports for easy importing
  predictDailyConsumption: predictionService.predictDailyConsumption,
  simulateWalletLifetime: predictionService.simulateWalletLifetime,
  getWalletLifetimePrediction: predictionService.getWalletLifetimePrediction
};
