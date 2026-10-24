const express = require('express');
const { 
  signup, 
  login, 
  staffLogin, 
  customerLogin, 
  logout, 
  getMe, 
  getSessionToken 
} = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/staff-login', authRateLimiter, staffLogin);
router.post('/customer-login', authRateLimiter, customerLogin);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/token', getSessionToken);
router.get('/token', getSessionToken);

module.exports = router;
