const express = require('express');
const { handleChat, getChatbotStatus } = require('./chatbotController');
const { requireAuth } = require('../../middlewares/authMiddleware');

const router = express.Router();

// Status endpoint accessible to verify module health
router.get('/status', requireAuth, getChatbotStatus);

// Main chat endpoint
router.post('/', requireAuth, handleChat);

module.exports = router;
