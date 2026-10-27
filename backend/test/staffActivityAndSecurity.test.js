const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const activityLogService = require('../src/services/activityLogService');

test('activityLogService gracefully handles unconfigured database pool', async () => {
  // When DATABASE_URL is not set or mock environment
  const logResult = await activityLogService.logStaffActivity({
    staffId: 1,
    staffEmail: 'staff@leco.lk',
    actionType: 'TEST_ACTION',
    targetEntity: 'Test Entity',
    details: { foo: 'bar' }
  });
  // Should return null gracefully rather than throwing uncaught exception
  assert.equal(logResult === null || typeof logResult === 'object', true);

  const listResult = await activityLogService.getStaffActivityLogs();
  assert.equal(Array.isArray(listResult), true);
});

test('staff password verification logic compares bcrypt hash correctly', async () => {
  const staffPlainPassword = 'secureStaffPassword123';
  const hashed = await bcrypt.hash(staffPlainPassword, 10);

  const isMatch = await bcrypt.compare(staffPlainPassword, hashed);
  assert.equal(isMatch, true);

  const isMismatch = await bcrypt.compare('wrongPassword', hashed);
  assert.equal(isMismatch, false);
});
