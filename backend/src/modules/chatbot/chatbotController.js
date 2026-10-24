const { processChatMessage } = require('./chatbotService');
const { sanitizeString } = require('../../middlewares/sanitizer');

/**
 * Process customer chat request
 */
const handleChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Valid message string is required' });
    }

    const cleanMessage = sanitizeString(message, 1000);
    const reply = await processChatMessage({
      message: cleanMessage,
      history: Array.isArray(history) ? history : [],
      userId
    });

    res.json({ reply });
  } catch (error) {
    console.error('[ChatbotModule] Error in handleChat:', error);
    res.status(500).json({ message: 'Failed to process chat message' });
  }
};

/**
 * Diagnostics & status check for the decoupled chatbot module
 */
const getChatbotStatus = (req, res) => {
  res.json({
    module: 'LECO Chatbot Assistant',
    status: 'online',
    engine: process.env.OPENAI_API_KEY ? 'OpenAI GPT-4o-mini (Tools Enabled)' : 'Local Smart Rule Engine',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  handleChat,
  getChatbotStatus
};
