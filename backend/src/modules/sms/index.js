const smsService = require('../../services/smsService');

/**
 * Decoupled SMS Notification Gateway Module
 * Provides unified interface for SMS dispatch, templating, and provider telemetry.
 */
module.exports = {
  service: smsService,
  sendSms: smsService.sendSms,
  sendEventSms: smsService.sendEventSms,
  normalizePhoneNumber: smsService.normalizePhoneNumber,
  SMS_TEMPLATES: smsService.SMS_TEMPLATES
};
