const express = require('express');
const { requireCustomer, developmentOnly } = require('../middlewares/authMiddleware');
const { 
  getUserMeters, 
  addMeter, 
  getMeterConsumption, 
  getMeterPrediction, 
  rechargeMeter, 
  getPaymentHistory,
  updateMeterName,
  activateEmergencyCredit,
  simulateConsumption,
  settleMonthlyCycle,
  setMeterBalance
} = require('../controllers/meterController');
const { createComplaint, getMyComplaints } = require('../controllers/complaintController');
const { getUserSettings, updateUserSettings, changePassword, updateMeterPin, updateMeterAlias } = require('../controllers/settingsController');
const { getUserNotifications, markAsRead } = require('../controllers/notificationController');
const { handleChat } = require('../controllers/chatController');
const { meterLinkRateLimiter, complaintRateLimiter, chatRateLimiter } = require('../middlewares/rateLimiter');
const { validateMeterInput } = require('../middlewares/sanitizer');
const { initPayhereCheckout, completePayhereCheckout } = require('../controllers/payhereController');
const { downloadPaymentReceiptPdf, downloadMeterStatementPdf } = require('../controllers/pdfController');

const router = express.Router();

// Strict Security Barrier: All customer endpoints require verified customer privileges
router.use(requireCustomer);

// Meters
router.get('/meters', getUserMeters);
router.post('/meters/add', meterLinkRateLimiter, validateMeterInput, addMeter);
router.patch('/meters/:meterId/name', updateMeterName);
router.get('/meters/:meterId/consumption', getMeterConsumption);
router.get('/meters/:meterId/prediction', getMeterPrediction);
router.get('/meters/:id/statement-pdf', downloadMeterStatementPdf);
router.get('/meters/statement-pdf', downloadMeterStatementPdf);
router.post('/meters/:meterId/recharge', rechargeMeter);
router.post('/meters/:meterId/emergency-credit', activateEmergencyCredit);
router.post('/meters/:meterId/simulate-consumption', developmentOnly, simulateConsumption);
router.post('/meters/:meterId/settle-cycle', developmentOnly, settleMonthlyCycle);
router.post('/meters/:meterId/set-balance', developmentOnly, setMeterBalance);

// Payments & Ledger
router.get('/payments/history', getPaymentHistory);
router.get('/payments/:id/receipt-pdf', downloadPaymentReceiptPdf);
router.get('/payments/receipt-pdf', downloadPaymentReceiptPdf);
router.post('/payments/payhere-init', initPayhereCheckout);
router.post('/payments/payhere-complete', completePayhereCheckout);

// Complaints & Support
router.get('/complaints', getMyComplaints);
router.post('/complaints', complaintRateLimiter, createComplaint);

// Settings & Profile
router.get('/settings', getUserSettings);
router.patch('/settings', updateUserSettings);
router.patch('/settings/password', changePassword);
router.patch('/settings/meter-pin', updateMeterPin);
router.patch('/settings/meter-name', updateMeterAlias);

// Notifications
router.get('/notifications', getUserNotifications);
router.put('/notifications/:id/read', markAsRead);

// AI Chatbot
router.post('/chat', chatRateLimiter, handleChat);

module.exports = router;
