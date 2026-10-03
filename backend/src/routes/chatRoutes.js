const express = require('express');
const { handleChat } = require('../controllers/chatController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.post('/', handleChat);

module.exports = router;
