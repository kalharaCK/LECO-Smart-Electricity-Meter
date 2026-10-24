/**
 * Chatbot Service proxy - logic has been decoupled into backend/src/modules/chatbot/
 * for independent development and isolation from core REST API.
 */
const chatbotModule = require('../modules/chatbot');

module.exports = {
  processChatMessage: chatbotModule.service.processChatMessage,
  getLastTopup: chatbotModule.service.getLastTopup,
  compareWeeklyUsage: chatbotModule.service.compareWeeklyUsage,
  getPredictedDays: chatbotModule.service.getPredictedDays,
  getCurrentMeterStatus: chatbotModule.service.getCurrentMeterStatus
};

