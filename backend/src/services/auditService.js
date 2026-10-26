const { pool } = require('../config/db');

/**
 * Audit Logging Service
 * Records administrative and security-sensitive operations with timestamps, actor IDs,
 * IP addresses, action types, and structured payloads.
 */

async function recordAuditLog({ actorId, actorRole, action, targetResource, targetId, details = {}, ip = null }) {
  try {
    const res = await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_resource, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [actorId || null, actorRole || 'system', action, targetResource, String(targetId || ''), JSON.stringify(details), ip]
    );
    return { success: true, logId: res.rows[0]?.id };
  } catch (err) {
    // Non-blocking logger: logs error without failing the core business request
    console.warn('[AuditService Warning] Failed to persist audit entry:', err.message);
    return { success: false, error: err.message };
  }
}

function formatAuditAction(action) {
  if (!action || typeof action !== 'string') return 'UNKNOWN_ACTION';
  return action.trim().toUpperCase().replace(/\s+/g, '_');
}

module.exports = {
  recordAuditLog,
  formatAuditAction
};
