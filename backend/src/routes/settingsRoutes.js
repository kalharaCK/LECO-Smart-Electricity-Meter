const express = require('express');
const {
  getUserSettings,
  updateUserSettings,
  changePassword,
  updateMeterPin,
  updateMeterAlias,
  deleteCustomerAccount
} = require('../controllers/settingsController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', getUserSettings);
router.patch('/', updateUserSettings);
router.post('/password', changePassword);
router.patch('/password', changePassword);
router.patch('/meter-pin', updateMeterPin);
router.patch('/meter-name', updateMeterAlias);
router.delete('/account', deleteCustomerAccount);
router.post('/delete-account', deleteCustomerAccount);

module.exports = router;
