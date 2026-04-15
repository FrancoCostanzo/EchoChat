const Joi = require('joi');

const notificationPrefsDto = Joi.object({
  event_type: Joi.string().max(50).required(),
  in_app_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  quiet_hours_start: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
  quiet_hours_end: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
});

module.exports = {
  notificationPrefsDto,
};
