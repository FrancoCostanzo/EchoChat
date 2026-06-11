const Joi = require('joi');

const adminCreateUserDto = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required(),
  display_name: Joi.string().max(100).required(),
  email: Joi.string().email().allow(null, ''),
  password: Joi.string().min(8).required(),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  role_names: Joi.array().items(Joi.string()).default(['user']),
});

const adminUpdateUserDto = Joi.object({
  display_name: Joi.string().max(100),
  email: Joi.string().email().allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  role_names: Joi.array().items(Joi.string()),
}).min(1);

const adminUpdateSettingDto = Joi.object({
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array(), Joi.object())
    .required(),
});

module.exports = {
  adminCreateUserDto,
  adminUpdateUserDto,
  adminUpdateSettingDto,
};
