const emailService = require('../services/emailService');

/**
 * GET /api/staff/email/config
 * Returns current email gateway configuration and masked credentials
 */
const getEmailConfig = async (req, res) => {
  try {
    const config = await emailService.getEmailConfigStatus();
    return res.json({
      success: true,
      config
    });
  } catch (err) {
    console.error('[Staff Email Controller] Error fetching config:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/staff/email/config
 * Updates email sender credentials and settings from Staff Portal
 */
const updateEmailConfig = async (req, res) => {
  try {
    const { senderEmail, appPassword, smtpHost, smtpPort } = req.body;
    if (!senderEmail || !senderEmail.trim()) {
      return res.status(400).json({ success: false, error: 'Sender email is required.' });
    }

    const result = await emailService.saveEmailConfig({
      senderEmail,
      appPassword,
      smtpHost,
      smtpPort
    });

    return res.json({
      success: true,
      message: 'Email gateway credentials updated successfully.',
      config: result.config
    });
  } catch (err) {
    console.error('[Staff Email Controller] Error updating config:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/staff/email/test
 * Dispatches a real-time diagnostic test email to verify credentials & delivery
 */
const sendStaffTestEmail = async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid test recipient email address is required.' });
    }

    const result = await emailService.sendTestEmail(testEmail);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to dispatch test email. Please check your sender email and Gmail app password.'
      });
    }

    return res.json({
      success: true,
      message: `Diagnostic test email delivered successfully to ${testEmail}`,
      messageId: result.messageId,
      sender: result.sender
    });
  } catch (err) {
    console.error('[Staff Email Controller] Error sending test email:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/staff/email/logs
 * Returns recent email delivery audit logs
 */
const getEmailLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await emailService.getEmailLogs(limit);
    return res.json({
      success: true,
      logs
    });
  } catch (err) {
    console.error('[Staff Email Controller] Error fetching email logs:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getEmailConfig,
  updateEmailConfig,
  sendStaffTestEmail,
  getEmailLogs
};
