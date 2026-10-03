const express = require('express');
const { 
  getUserMeters, 
  addMeter, 
  getMeterConsumption, 
  getMeterPrediction, 
  rechargeMeter, 
  getPaymentHistory,
  updateMeterName,
  activateEmergencyCredit,
  simulateConsumption,
  setMeterBalance 
} = require('../controllers/meterController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { meterLinkRateLimiter } = require('../middlewares/rateLimiter');
const { validateMeterInput } = require('../middlewares/sanitizer');

const router = express.Router();

// All meter routes require authentication
router.use(requireAuth);

router.get('/', getUserMeters);
router.post('/add', meterLinkRateLimiter, validateMeterInput, addMeter);
router.patch('/:meterId/name', updateMeterName);
router.post('/:meterId/emergency-credit', activateEmergencyCredit);
router.post('/:meterId/simulate-consumption', simulateConsumption);
router.post('/:meterId/set-balance', setMeterBalance);
router.get('/payments/history', getPaymentHistory);
router.get('/:meterId/consumption', getMeterConsumption);
router.get('/:meterId/prediction', getMeterPrediction);
router.post('/:meterId/recharge', rechargeMeter);

module.exports = router;
