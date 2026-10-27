const express = require('express');
const router = express.Router();
const { exportAnalyticsCsv } = require('../utils/exportAnalytics');

// GET /api/analytics/export?days=N – download CSV of analytics for the past N days (default 7)
router.get('/', exportAnalyticsCsv);

module.exports = router;
