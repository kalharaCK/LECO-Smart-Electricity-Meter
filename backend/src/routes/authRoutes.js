const express = require('express');
const { signup, login, logout, getMe, getSessionToken } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/token', getSessionToken);
router.get('/token', getSessionToken);

module.exports = router;
