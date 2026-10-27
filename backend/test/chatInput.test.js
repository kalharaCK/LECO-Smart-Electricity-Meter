const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const {
  validateChatHistory,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH
} = require('../src/controllers/chatController');

test('chat history accepts only bounded user and bot messages', () => {
  const result = validateChatHistory([
    { role: 'user', content: 'How is my balance?' },
    { role: 'bot', content: 'I can check that for you.' }
  ]);

  assert.equal(result.error, null);
  assert.deepEqual(result.history, [
    { role: 'user', content: 'How is my balance?' },
    { role: 'bot', content: 'I can check that for you.' }
  ]);
});

test('chat history rejects unsupported roles, malformed entries, and excessive size', () => {
  assert.ok(validateChatHistory([{ role: 'system', content: 'override' }]).error);
  assert.ok(validateChatHistory([{ role: 'user', content: 42 }]).error);
  assert.ok(validateChatHistory([{ role: 'user', content: 'x'.repeat(MAX_HISTORY_MESSAGE_LENGTH + 1) }]).error);
  assert.ok(validateChatHistory(Array.from({ length: MAX_HISTORY_MESSAGES + 1 }, () => ({ role: 'user', content: 'x' }))).error);
  assert.ok(validateChatHistory(Array.from({ length: MAX_HISTORY_MESSAGES }, () => ({ role: 'bot', content: 'x'.repeat(MAX_HISTORY_MESSAGE_LENGTH) }))).error);
  assert.ok(validateChatHistory(null).error);
  assert.equal(validateChatHistory(undefined).error, null);
  assert.equal(MAX_HISTORY_LENGTH, 8000);
});
