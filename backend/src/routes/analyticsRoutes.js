const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analyticsController');

// GET /api/analytics - role‑based analytics data
router.get('/', getAnalytics);

module.exports = router;
