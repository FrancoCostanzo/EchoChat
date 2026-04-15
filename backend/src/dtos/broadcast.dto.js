const Joi = require('joi');

const createBroadcastListDto = Joi.object({
  name: Joi.string().max(200).required(),
  description: Joi.string().allow(null, ''),
  recipient_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const sendBroadcastDto = Joi.object({
  body: Joi.string().max(10000).required(),
  type: Joi.string().valid('text', 'media', 'template').default('text'),
  object_id: Joi.string().uuid().allow(null),
  scheduled_at: Joi.date().iso().allow(null),
});

module.exports = {
  createBroadcastListDto,
  sendBroadcastDto,
};
