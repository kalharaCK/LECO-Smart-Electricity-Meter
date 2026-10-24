const chatbotModule = require('../modules/chatbot');

module.exports = {
  handleChat: chatbotModule.controller.handleChat,
  getChatbotStatus: chatbotModule.controller.getChatbotStatus
};

