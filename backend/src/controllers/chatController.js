const chatbotModule = require('../modules/chatbot');

module.exports = {
  handleChat: chatbotModule.controller.handleChat,
  getChatbotStatus: chatbotModule.controller.getChatbotStatus,
  validateChatHistory: chatbotModule.controller.validateChatHistory,
  MAX_HISTORY_MESSAGES: chatbotModule.controller.MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH: chatbotModule.controller.MAX_HISTORY_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH: chatbotModule.controller.MAX_HISTORY_LENGTH
};

