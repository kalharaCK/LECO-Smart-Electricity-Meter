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
  getMe
} = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authRateLimiter, otpSendRateLimiter, otpVerifyRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Registration & OTP verification
router.post('/register/send-otp', authRateLimiter, otpSendRateLimiter, sendRegisterOtp);
router.post('/register', authRateLimiter, otpVerifyRateLimiter, registerWithProfile);
router.post('/signup', authRateLimiter, signup);

// Forgot Password Flow with NIC, Mobile & OTP
router.post('/forgot-password/send-otp', authRateLimiter, otpSendRateLimiter, sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', authRateLimiter, otpVerifyRateLimiter, verifyForgotPasswordOtp);
router.post('/forgot-password/reset', authRateLimiter, otpVerifyRateLimiter, resetPasswordWithOtp);

// Standard Login & Sessions
router.post('/login', authRateLimiter, login);
router.post('/staff-login', authRateLimiter, staffLogin);
router.post('/customer-login', authRateLimiter, customerLogin);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

module.exports = router;
