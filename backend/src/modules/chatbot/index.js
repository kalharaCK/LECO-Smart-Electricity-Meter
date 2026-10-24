const chatbotRoutes = require('./chatbotRoutes');
const chatbotService = require('./chatbotService');
const chatbotController = require('./chatbotController');

module.exports = {
  router: chatbotRoutes,
  service: chatbotService,
  controller: chatbotController,
  processChatMessage: chatbotService.processChatMessage,
  getLastTopup: chatbotService.getLastTopup,
  compareWeeklyUsage: chatbotService.compareWeeklyUsage,
  getPredictedDays: chatbotService.getPredictedDays,
  getCurrentMeterStatus: chatbotService.getCurrentMeterStatus
};
