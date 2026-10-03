const { pool } = require('../config/db');
const { emitComplaintUpdate, emitNotification } = require('../services/socketService');

/**
 * Generate a unique LECO Ticket Number, e.g. CMP-84921
 */
const generateTicketNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const ticket = `CMP-${randomDigits}`;
    const check = await pool.query('SELECT id FROM complaints WHERE ticket_number = $1', [ticket]);
    if (check.rows.length === 0) {
      return ticket;
    }
  }
  return `CMP-${Date.now().toString().slice(-5)}`;
};

/**
 * Submit a new customer complaint
 * POST /api/complaints
 */
const createComplaint = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      complaint_type,
      subject,
      description,
      priority = 'medium',
      meter_id = null
    } = req.body;

    if (!complaint_type || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Complaint type, subject, and description are required.'
      });
    }

    // Resolve meter_id if not explicitly provided
    let resolvedMeterId = meter_id ? parseInt(meter_id, 10) : null;
    if (!resolvedMeterId) {
      const userMeter = await pool.query(
        'SELECT id FROM meters WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [userId]
      );
      if (userMeter.rows.length > 0) {
        resolvedMeterId = userMeter.rows[0].id;
      }
    }

    const ticketNumber = await generateTicketNumber();

    const insertResult = await pool.query(
      `INSERT INTO complaints (
        ticket_number,
        user_id,
        meter_id,
        complaint_type,
        subject,
        description,
        priority,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
      RETURNING *`,
      [ticketNumber, userId, resolvedMeterId, complaint_type, subject, description, priority]
    );

    const complaint = insertResult.rows[0];

    // Create user notification
    const notifResult = await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, 'info', $3, $4)
       RETURNING *`,
      [
        userId,
        resolvedMeterId,
        'Complaint Queued',
        `Ticket #${ticketNumber} (${subject}) has entered our engineering review queue.`
      ]
    );

    // Real-time broadcasts
    emitComplaintUpdate(userId, complaint);
    if (notifResult.rows.length > 0) {
      emitNotification(userId, notifResult.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully and placed in tracking queue.',
      complaint
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error submitting complaint.'
    });
  }
};

/**
 * Get all complaints for the authenticated customer
 * GET /api/complaints/my
 */
const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT c.*, 
              m.meter_number,
              m.name AS meter_name
       FROM complaints c
       LEFT JOIN meters m ON c.meter_id = m.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      complaints: result.rows
    });
  } catch (error) {
    console.error('Error fetching customer complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching complaints.'
    });
  }
};

/**
 * Get single complaint details by ID
 * GET /api/complaints/:id
 */
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT c.*, 
              m.meter_number,
              m.name AS meter_name
       FROM complaints c
       LEFT JOIN meters m ON c.meter_id = m.id
       WHERE c.id = $1 AND (c.user_id = $2 OR $3 = 'admin' OR $3 = 'staff')`,
      [id, userId, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found or unauthorized access.'
      });
    }

    return res.json({
      success: true,
      complaint: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching complaint by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching complaint.'
    });
  }
};

/**
 * Update complaint status (Simulate progression or staff resolution)
 * PATCH /api/complaints/:id/status
 */
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;

    const validStatuses = ['submitted', 'in_review', 'investigating', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values are: ${validStatuses.join(', ')}`
      });
    }

    const check = await pool.query('SELECT * FROM complaints WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.'
      });
    }

    const currentComplaint = check.rows[0];
    const isResolved = status === 'resolved' || status === 'closed';

    const updateResult = await pool.query(
      `UPDATE complaints 
       SET status = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           resolved_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, resolution_notes || null, isResolved, id]
    );

    const updated = updateResult.rows[0];

    // Format human-friendly status label
    const statusLabelMap = {
      submitted: 'Submitted',
      in_review: 'In Review',
      investigating: 'Under Investigation',
      resolved: 'Resolved',
      closed: 'Closed'
    };

    // Notify user of progress
    const notifResult = await pool.query(
      `INSERT INTO notifications (user_id, meter_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        updated.user_id,
        updated.meter_id,
        isResolved ? 'success' : 'info',
        `Ticket #${updated.ticket_number} Updated`,
        `Your complaint is now '${statusLabelMap[status] || status}'. ${resolution_notes ? 'Note: ' + resolution_notes : ''}`
      ]
    );

    emitComplaintUpdate(updated.user_id, updated);
    if (notifResult.rows.length > 0) {
      emitNotification(updated.user_id, notifResult.rows[0]);
    }

    return res.json({
      success: true,
      message: `Complaint status updated to ${status}.`,
      complaint: updated
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error updating complaint status.'
    });
  }
};

/**
 * Get all complaints in system (for staff / administrative review)
 * GET /api/complaints/all
 */
const getAllComplaints = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
              u.email AS customer_email,
              m.meter_number,
              m.name AS meter_name
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN meters m ON c.meter_id = m.id
       ORDER BY c.created_at DESC`
    );

    return res.json({
      success: true,
      complaints: result.rows
    });
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching all complaints.'
    });
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  updateComplaintStatus,
  getAllComplaints
};
