const express = require('express');
const { 
  signup, 
  sendRegisterOtp,
  registerWithProfile,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
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

// Registration & OTP verification
router.post('/register/send-otp', authRateLimiter, sendRegisterOtp);
router.post('/register', authRateLimiter, registerWithProfile);
router.post('/signup', authRateLimiter, signup);

// Forgot Password Flow with NIC, Mobile & OTP
router.post('/forgot-password/send-otp', authRateLimiter, sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', authRateLimiter, verifyForgotPasswordOtp);
router.post('/forgot-password/reset', authRateLimiter, resetPasswordWithOtp);

// Standard Login & Sessions
router.post('/login', authRateLimiter, login);
router.post('/staff-login', authRateLimiter, staffLogin);
router.post('/customer-login', authRateLimiter, customerLogin);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/token', getSessionToken);
router.get('/token', getSessionToken);

module.exports = router;
