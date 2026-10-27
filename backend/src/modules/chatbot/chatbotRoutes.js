const express = require('express');
const { handleChat, getChatbotStatus } = require('./chatbotController');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { chatRateLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// Status endpoint accessible to verify module health
router.get('/status', requireAuth, getChatbotStatus);

// Main chat endpoint
router.post('/', requireAuth, chatRateLimiter, handleChat);

module.exports = router;
