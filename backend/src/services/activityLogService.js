/**
 * Staff Activity & Traceable Audit Logging Service
 * Records administrative and grid operations performed by LECO staff.
 */

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  return require('../config/db').pool;
}

/**
 * Initializes staff_activity_logs table
 */
async function initializeActivityLogsTable() {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_activity_logs (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        staff_email VARCHAR(255) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        target_entity VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(100),
        status VARCHAR(50) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_action ON staff_activity_logs(action_type);
      CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_created ON staff_activity_logs(created_at DESC);
    `);
  } catch (err) {
    console.warn('[ActivityLogService] Table init notice:', err.message);
  }
}

/**
 * Records a traceable staff action
 */
async function logStaffActivity({
  staffId = null,
  staffEmail = 'staff@leco.lk',
  actionType,
  targetEntity = 'System',
  details = {},
  ipAddress = '127.0.0.1',
  status = 'success'
}) {
  const pool = getPool();
  if (!pool) return null;

  try {
    const detailsJson = typeof details === 'object' ? JSON.stringify(details) : JSON.stringify({ message: String(details) });
    const res = await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, staff_email, action_type, target_entity, details, ip_address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, staff_email, action_type, target_entity, created_at`,
      [staffId, staffEmail, actionType, targetEntity, detailsJson, ipAddress, status]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('[ActivityLogService] Failed to record staff activity log:', err.message);
    return null;
  }
}

/**
 * Retrieves recent staff activity logs with optional action filter and search
 */
async function getStaffActivityLogs({ limit = 100, actionType = '', search = '' } = {}) {
  const pool = getPool();
  if (!pool) return [];

  try {
    let query = `
      SELECT id, staff_id, staff_email, action_type, target_entity, details, ip_address, status, created_at
      FROM staff_activity_logs
      WHERE 1=1
    `;
    const params = [];

    if (actionType && actionType.trim()) {
      params.push(actionType.trim());
      query += ` AND action_type = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(staff_email) LIKE $${params.length} OR LOWER(target_entity) LIKE $${params.length} OR LOWER(action_type) LIKE $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(250, parseInt(limit, 10) || 100));

    const res = await pool.query(query, params);
    return res.rows;
  } catch (err) {
    console.warn('[ActivityLogService] Failed to fetch staff activity logs:', err.message);
    return [];
  }
}

module.exports = {
  initializeActivityLogsTable,
  logStaffActivity,
  getStaffActivityLogs
};
