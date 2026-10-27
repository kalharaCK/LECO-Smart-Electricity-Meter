const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
const { pool } = require('../src/config/db');
const chatbotService = require('../src/modules/chatbot/chatbotService');

test('chatbot prompts user to connect a meter when none is linked', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [] });

  try {
    const reply = await chatbotService.processChatMessage({
      message: 'What is my current balance?',
      userId: 999
    });
    assert.ok(reply.includes('do not have any smart meters'));
    assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(reply), false, 'Reply should contain no emojis');
  } finally {
    pool.query = originalQuery;
  }
});

test('chatbot fallback gracefully handles general and off-topic inquiries without emojis', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ id: 101 }] });

  try {
    const offTopicReply = await chatbotService.processChatMessage({
      message: 'What is the weather today?',
      userId: 101
    });
    assert.ok(offTopicReply.includes('LECO Smart Energy Assistant'));
    assert.ok(offTopicReply.includes('specialize in electricity consumption'));
    assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(offTopicReply), false, 'Reply should contain no emojis');

    const greetingReply = await chatbotService.processChatMessage({
      message: 'Hello there',
      userId: 101
    });
    assert.ok(greetingReply.includes('LECO Smart Energy Assistant'));
    assert.ok(greetingReply.includes('Estimating how many days'));
    assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(greetingReply), false, 'Reply should contain no emojis');
  } finally {
    pool.query = originalQuery;
  }
});
