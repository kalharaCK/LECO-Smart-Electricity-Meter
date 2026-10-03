const express = require('express');
const { getUserMeters, addMeter, getMeterConsumption, rechargeMeter, getPaymentHistory } = require('../controllers/meterController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// All meter routes require authentication
router.use(requireAuth);

router.get('/', getUserMeters);
router.post('/add', addMeter);
router.get('/payments/history', getPaymentHistory);
router.get('/:meterId/consumption', getMeterConsumption);
router.post('/:meterId/recharge', rechargeMeter);

module.exports = router;
