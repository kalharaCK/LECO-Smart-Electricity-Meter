const express = require('express');
const { handleChat } = require('../controllers/chatController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { chatRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(requireAuth);

router.post('/', chatRateLimiter, handleChat);

module.exports = router;
