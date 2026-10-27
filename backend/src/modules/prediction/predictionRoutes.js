const express = require('express');
const {
  getMeterPrediction,
  simulatePrediction,
  getMLHourlyForecast,
  getMLPrepaidForecast,
  getMLPostpaidForecast,
  getMLRechargeDemand,
  getMLModelStatus
} = require('./predictionController');
const { requireAuth } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/meter/:meterId', getMeterPrediction);
router.post('/simulate', simulatePrediction);

// Direct ML Service Endpoints
router.get('/ml/hourly/:meterId', getMLHourlyForecast);
router.get('/ml/prepaid/:meterId', getMLPrepaidForecast);
router.get('/ml/postpaid/:meterId', getMLPostpaidForecast);
router.get('/ml/demand/:meterId', getMLRechargeDemand);
router.get('/ml/status/:meterId', getMLModelStatus);

module.exports = router;

