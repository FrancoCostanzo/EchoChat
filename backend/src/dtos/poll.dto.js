const Joi = require('joi');

const createPollDto = Joi.object({
  conversation_id: Joi.string().uuid().required(),
  question: Joi.string().max(500).required(),
  options: Joi.array().items(Joi.string().max(300)).min(2).max(10).required(),
  is_anonymous: Joi.boolean().default(false),
  is_multiple: Joi.boolean().default(false),
  closes_at: Joi.date().iso().allow(null),
});

const voteDto = Joi.object({
  option_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  createPollDto,
  voteDto,
};
