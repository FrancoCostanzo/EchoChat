const Joi = require('joi');

const registerDto = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required()
    .messages({ 'string.pattern.base': 'Username can only contain letters, numbers, dots and underscores' }),
  display_name: Joi.string().max(100).required(),
  email: Joi.string().email().allow(null, ''),
  password: Joi.string().min(8).max(128).required(),
  phone_extension: Joi.string().max(20).allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
});

const loginDto = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
  device_name: Joi.string().max(100).allow(null, ''),
  device_type: Joi.string().valid('web', 'desktop', 'mobile', 'api').default('web'),
});

const updateProfileDto = Joi.object({
  display_name: Joi.string().max(100),
  email: Joi.string().email().allow(null, ''),
  phone_extension: Joi.string().max(20).allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  presence: Joi.string().valid('online', 'offline', 'away', 'busy', 'dnd'),
  presence_message: Joi.string().max(200).allow(null, ''),
  timezone: Joi.string().max(50),
  locale: Joi.string().max(10),
}).min(1);

const changePasswordDto = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(128).required(),
});

module.exports = {
  registerDto,
  loginDto,
  updateProfileDto,
  changePasswordDto,
};
