const { processChatMessage } = require('./chatbotService');
const { sanitizeString } = require('../../middlewares/sanitizer');

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 8000;

function validateChatHistory(history) {
  if (history === undefined) return { history: [], error: null };
  if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
    return { error: `History must be an array of at most ${MAX_HISTORY_MESSAGES} messages.` };
  }

  const normalized = [];
  let totalLength = 0;
  for (const entry of history) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        !['user', 'bot', 'assistant'].includes(entry.role)) {
      return { error: 'Each history message must have a user or bot role.' };
    }
    const content = entry.content ?? entry.text;
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_HISTORY_MESSAGE_LENGTH) {
      return { error: `Each history message must contain 1 to ${MAX_HISTORY_MESSAGE_LENGTH} characters.` };
    }
    totalLength += content.length;
    if (totalLength > MAX_HISTORY_LENGTH) {
      return { error: `History cannot exceed ${MAX_HISTORY_LENGTH} characters in total.` };
    }
    normalized.push({ role: entry.role, content: sanitizeString(content, MAX_HISTORY_MESSAGE_LENGTH) });
  }
  return { history: normalized, error: null };
}

/**
 * Process customer chat request
 */
const handleChat = async (req, res) => {
  try {
    const { message, history, language, meterId } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || !message.trim()) {
      if (res.headersSent) return;
      return res.status(400).json({ message: 'Valid message string is required' });
    }

    const cleanMessage = sanitizeString(message, 1000);
    if (!cleanMessage) {
      if (res.headersSent) return;
      return res.status(400).json({ message: 'Valid message string is required' });
    }

    const validatedHistory = validateChatHistory(history);
    if (validatedHistory.error) {
      if (res.headersSent) return;
      return res.status(400).json({ message: validatedHistory.error });
    }

    const result = await processChatMessage({
      message: cleanMessage,
      history: validatedHistory.history,
      userId,
      language: typeof language === 'string' ? language.trim().toLowerCase() : null,
      meterId: meterId ? parseInt(meterId, 10) : null
    });

    if (res.headersSent) return;

    const replyText = typeof result === 'string' ? result : (result.reply || String(result));
    const actions = result.actions || [];
    const detectedLang = result.language || language || 'en';
    const source = result.source || 'offline_rag';

    res.json({
      reply: replyText,
      actions,
      language: detectedLang,
      source,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ChatbotModule] Error in handleChat:', error);
    if (res.headersSent) return;
    res.status(500).json({ message: 'Failed to process chat message' });
  }
};

/**
 * Diagnostics & status check for the decoupled chatbot module
 */
const getChatbotStatus = (req, res) => {
  if (res.headersSent) return;
  const hasGroq = Boolean(process.env.GROQ_KEY || process.env.GROQ_API_KEY);
  res.json({
    module: 'LECO Smart Energy Assistant',
    status: 'online',
    architecture: 'RAG Knowledge Retriever + Telemetry Snapshot + Groq LLM + Offline Tri-Lingual Engine',
    engine: hasGroq ? 'Groq High-Speed LLM (RAG Augmented)' : 'Local Tri-Lingual Knowledge Engine',
    groqAvailable: hasGroq,
    supportedLanguages: ['en', 'si', 'ta'],
    securityGuards: ['Prompt Injection Defense', 'Prompt Positioning Sandbox', 'Zero-Emoji Enforcement'],
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  handleChat,
  getChatbotStatus,
  validateChatHistory,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH
};
