const express = require('express');
const {
  getUserSettings,
  updateUserSettings,
  changePassword,
  updateMeterPin,
  updateMeterAlias
} = require('../controllers/settingsController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', getUserSettings);
router.patch('/', updateUserSettings);
router.patch('/password', changePassword);
router.patch('/meter-pin', updateMeterPin);
router.patch('/meter-name', updateMeterAlias);

module.exports = router;
