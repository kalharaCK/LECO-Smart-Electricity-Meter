const express = require('express');
const { getUserNotifications, markAsRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', getUserNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
