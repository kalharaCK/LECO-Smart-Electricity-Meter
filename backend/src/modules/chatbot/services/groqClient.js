/**
 * Groq API Client for General & Advanced Inquiries
 * Connects to Groq OpenAI-compatible chat completions endpoint.
 * Features:
 * - Auto-model selection and fallback (qwen/qwen3.8-27b, openai/gpt-oss-120b, etc.)
 * - Fast timeout guard (8000ms) with AbortSignal
 * - Rate limit (HTTP 429) detection & graceful fallback signaling
 * - Strict emoji elimination on response output
 */

const { stripEmojis } = require('../security/promptGuard');

const CANDIDATE_MODELS = [
  process.env.GROQ_MODEL,
  'qwen/qwen3.8-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
].filter(Boolean);

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const systemSettingsService = require('../../../services/systemSettingsService');

/**
 * Call Groq API with prompt messages
 *
 * @param {Array<{ role: string, content: string }>} messages - Chat messages array
 * @param {object} [options] - Optional settings (temperature, max_tokens)
 * @returns {Promise<{ success: boolean, reply?: string, reason?: string, modelUsed?: string }>}
 */
async function callGroqChat(messages, options = {}) {
  const apiKey = (systemSettingsService.getSettingSync('GROQ_API_KEY', process.env.GROQ_KEY || process.env.GROQ_API_KEY || '')).trim();

  if (!apiKey) {
    return { success: false, reason: 'missing_api_key' };
  }

  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 600;

  for (const model of CANDIDATE_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        console.warn(`[GroqClient] Rate limit (429) encountered on model ${model}. Triggering graceful fallback.`);
        return { success: false, reason: 'rate_limited' };
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.warn(`[GroqClient] Model ${model} returned HTTP ${response.status}: ${errorBody.slice(0, 100)}`);
        // If 404 (model not found), continue loop to test next model
        if (response.status === 404) {
          continue;
        }
        return { success: false, reason: `http_${response.status}` };
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content || '';

      if (!rawText.trim()) {
        continue;
      }

      // Strictly eliminate all emojis from LLM response
      const cleanReply = stripEmojis(rawText);

      return {
        success: true,
        reply: cleanReply,
        modelUsed: model
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[GroqClient] Request timed out on model ${model} (8s timeout).`);
      } else {
        console.warn(`[GroqClient] Connection error on model ${model}:`, err.message);
      }
    }
  }

  return { success: false, reason: 'all_models_failed' };
}

module.exports = {
  callGroqChat,
  CANDIDATE_MODELS
};
