const express = require('express');
const { getMeterPrediction, simulatePrediction } = require('./predictionController');
const { requireAuth } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/meter/:meterId', getMeterPrediction);
router.post('/simulate', simulatePrediction);

module.exports = router;
