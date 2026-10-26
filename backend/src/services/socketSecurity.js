function extractSessionToken(cookieHeader = '') {
  const cookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith('token='));
  return cookie ? decodeURIComponent(cookie.slice('token='.length)) : null;
}

function meterRoomAccessQuery(role, meterId, userId) {
  if (role === 'staff' || role === 'admin') {
    return ['SELECT id FROM meters WHERE id = $1', [meterId]];
  }
  if (role === 'customer' || role === 'user') {
    return ['SELECT id FROM meters WHERE id = $1 AND user_id = $2', [meterId, userId]];
  }
  return null;
}

module.exports = { extractSessionToken, meterRoomAccessQuery };
