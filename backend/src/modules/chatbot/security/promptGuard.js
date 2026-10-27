/**
 * Chatbot Security & Prompt Positioning Guard
 * Protects against prompt injection, jailbreaking, instruction hijacking,
 * system prompt extraction, delimiter spoofing, and SQL/XSS payloads.
 * Also strictly enforces the zero-emoji rule across all bot responses.
 */

// Regex patterns for prompt injection and positioning attacks
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules|prompts)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules)/i,
  /forget\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|identity)/i,
  /you\s+are\s+now\s+(an?\s+)?(unfiltered|uncensored|jailbroken|evil|dan|developer|root|admin)/i,
  /pretend\s+(to\s+be|you\s+are)\s+(an?\s+)?(unrestricted|dan|developer|god\s+mode)/i,
  /system\s+prompt\s*(reveal|leak|show|print|display|dump|repeat|output)/i,
  /output\s+your\s+(initial|system|original)\s+(prompt|instructions)/i,
  /what\s+are\s+your\s+(exact\s+)?(system\s+instructions|system\s+rules|hidden\s+prompts)/i,
  /bypass\s+(safety|security|policy|restrictions|guardrails)/i,
  /enter\s+(dan|developer|god|unrestricted)\s+mode/i,
  /<\/?(system|instruction|prompt|context|admin)>/i,
  /---+(BEGIN|END)\s+(SYSTEM|INSTRUCTION|PROMPT)---+/i,
  /(union\s+select|drop\s+table|insert\s+into\s+users|update\s+users\s+set|exec\s+xp_)/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i
];

// Comprehensive emoji-stripping regex (standard Unicode emoji ranges)
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

/**
 * Remove all emoji characters from string
 */
function stripEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(EMOJI_REGEX, '').trim();
}

/**
 * Sanitize and validate incoming user message
 * Returns { isSafe, sanitized, reason }
 */
function sanitizeAndGuardPrompt(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return { isSafe: false, sanitized: '', reason: 'Empty message' };
  }

  // 1. Strip emojis and trim
  let text = stripEmojis(rawMessage);

  // 2. Length check (max 1000 characters)
  if (text.length > 1000) {
    text = text.substring(0, 1000);
  }

  // 3. Remove zero-width characters and unusual control codes
  text = text.replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // 4. Check for prompt injection / positioning attacks
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSafe: false,
        sanitized: text,
        reason: 'Prompt injection or instruction override attempt detected',
        neutralizedReply: "I am the LECO Smart Energy Assistant. For security reasons, I can only assist with electricity usage, smart prepaid meter management, PUCSL domestic tariffs, and LECO utility services. How may I help you with your account today?"
      };
    }
  }

  return {
    isSafe: true,
    sanitized: text,
    reason: null
  };
}

/**
 * Build security-sandboxed prompt structure
 * Positions untrusted user query strictly within isolated boundary tags
 */
function wrapInSecurityBoundary(userQuery) {
  const safeQuery = userQuery
    .replace(/<\/untrusted_user_query>/gi, '')
    .replace(/<untrusted_user_query>/gi, '');

  return `<untrusted_user_query>\n${safeQuery}\n</untrusted_user_query>`;
}

/**
 * Detect language of query: 'si' (Sinhala), 'ta' (Tamil), or 'en' (English)
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  // Sinhala Unicode range: \u0D80-\u0DFF
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  // Tamil Unicode range: \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  return 'en';
}

module.exports = {
  sanitizeAndGuardPrompt,
  wrapInSecurityBoundary,
  stripEmojis,
  detectLanguage,
  EMOJI_REGEX
};
