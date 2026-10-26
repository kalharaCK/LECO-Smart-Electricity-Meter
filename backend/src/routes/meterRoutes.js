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
  settleMonthlyCycle,
  setMeterBalance,
  getAllMetersForStaff,
  toggleMeterRelay,
  staffTopupMeter
} = require('../controllers/meterController');
const { requireAuth, requireCustomer, requireStaff, developmentOnly } = require('../middlewares/authMiddleware');
const { meterLinkRateLimiter } = require('../middlewares/rateLimiter');
const { validateMeterInput } = require('../middlewares/sanitizer');

const router = express.Router();

// General authentication barrier
router.use(requireAuth);

/**
 * Staff-only operations (Strictly guarded by requireStaff)
 * Prevents ordinary customers from manipulating grid status or crediting balances
 */
router.get('/all', requireStaff, getAllMetersForStaff);
router.post('/:meterId/toggle-relay', requireStaff, toggleMeterRelay);
router.post('/:meterId/staff-topup', requireStaff, staffTopupMeter);

/**
 * Customer-only meter operations (Guarded by requireCustomer)
 */
router.get('/', requireCustomer, getUserMeters);
router.post('/add', requireCustomer, meterLinkRateLimiter, validateMeterInput, addMeter);
router.patch('/:meterId/name', requireCustomer, updateMeterName);
router.post('/:meterId/emergency-credit', requireCustomer, activateEmergencyCredit);
router.post('/:meterId/simulate-consumption', requireCustomer, developmentOnly, simulateConsumption);
router.post('/:meterId/settle-cycle', requireCustomer, developmentOnly, settleMonthlyCycle);
router.post('/:meterId/set-balance', requireCustomer, developmentOnly, setMeterBalance);
router.get('/payments/history', requireCustomer, getPaymentHistory);
router.get('/:meterId/consumption', requireCustomer, getMeterConsumption);
router.get('/:meterId/prediction', requireCustomer, getMeterPrediction);
router.post('/:meterId/recharge', requireCustomer, rechargeMeter);

module.exports = router;
