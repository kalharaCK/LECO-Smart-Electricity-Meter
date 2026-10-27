const systemSettingsService = require('../services/systemSettingsService');

/**
 * GET /api/staff/system-settings
 * Returns all system API credentials (masked) and customer feature toggles
 */
const getStaffSettings = async (req, res) => {
  try {
    const data = await systemSettingsService.getAllSettingsForStaff();
    return res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('[Staff Settings Controller] Error getting settings:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/staff/system-settings
 * Updates dynamic API keys, models, and customer dashboard feature control switches
 */
const updateStaffSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid settings object is required.' });
    }

    const staffEmail = req.user?.email || 'staff@leco.lk';
    const result = await systemSettingsService.updateSettings(settings, staffEmail);

    const { logStaffActivity } = require('../services/activityLogService');
    await logStaffActivity({
      staffId: req.user?.id || null,
      staffEmail,
      actionType: 'UPDATE_SYSTEM_SETTINGS',
      targetEntity: 'API Keys & Feature Flags',
      details: {
        updatedKeys: result.updatedKeys
      },
      ipAddress: req.ip || '127.0.0.1',
      status: 'success'
    });

    return res.json({
      success: true,
      message: 'System settings and feature toggles updated successfully.',
      updatedKeys: result.updatedKeys
    });
  } catch (err) {
    console.error('[Staff Settings Controller] Error updating settings:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/public/features
 * Publicly accessible customer endpoint returning active feature flags and maintenance banner
 */
const getPublicFeatures = (req, res) => {
  try {
    const features = systemSettingsService.getPublicFeatureFlags();
    return res.json({
      success: true,
      features
    });
  } catch (err) {
    console.error('[Public Features] Error getting feature flags:', err);
    return res.status(500).json({
      success: false,
      features: {
        aiChatbot: true,
        onlineTopup: true,
        mlPrediction: true,
        lifelineMode: true,
        complaintsPortal: true,
        solarTelemetry: true,
        maintenanceMode: false,
        maintenanceBanner: ''
      }
    });
  }
};

module.exports = {
  getStaffSettings,
  updateStaffSettings,
  getPublicFeatures
};
