const Joi = require('joi');

const sendMessageDto = Joi.object({
  conversation_id: Joi.string().uuid().required(),
  type: Joi.string().valid('text', 'media', 'location', 'contact', 'poll', 'forwarded').default('text'),
  body: Joi.string().max(10000).when('type', {
    is: 'text',
    then: Joi.required(),
    otherwise: Joi.allow(null, ''),
  }),
  body_format: Joi.string().valid('plain', 'markdown', 'html').default('plain'),
  reply_to_id: Joi.string().uuid().allow(null),
  thread_id: Joi.string().uuid().allow(null),
  forwarded_from_id: Joi.string().uuid().allow(null),
  attachment_ids: Joi.array().items(Joi.string().uuid()).default([]),
  metadata: Joi.object().default({}),
});

const updateMessageDto = Joi.object({
  body: Joi.string().max(10000).required(),
});

const reactionDto = Joi.object({
  emoji: Joi.string().max(10).required(),
});

const paginationDto = Joi.object({
  cursor: Joi.string().uuid().allow(null),
  limit: Joi.number().integer().min(1).max(100).default(50),
  direction: Joi.string().valid('before', 'after').default('before'),
});

module.exports = {
  sendMessageDto,
  updateMessageDto,
  reactionDto,
  paginationDto,
};
