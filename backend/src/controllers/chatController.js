const { processChatMessage } = require('../services/chatService');
const { sanitizeString } = require('../middlewares/sanitizer');

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
    console.error('Error in chat controller:', error);
    res.status(500).json({ message: 'Failed to process chat message' });
  }
};

module.exports = {
  handleChat
};
