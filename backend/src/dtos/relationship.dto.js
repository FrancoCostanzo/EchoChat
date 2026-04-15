const Joi = require('joi');

const relationshipDto = Joi.object({
  target_user_id: Joi.string().uuid().required(),
  type: Joi.string().valid('contact', 'blocked', 'favorite').required(),
  alias: Joi.string().max(100).allow(null, ''),
});

module.exports = {
  relationshipDto,
};
