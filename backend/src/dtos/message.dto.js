const Joi = require('joi');

const sendMessageDto = Joi.object({
  conversation_id: Joi.string().uuid().required(),
  type: Joi.string()
    .valid('text', 'media', 'location', 'contact', 'poll', 'forwarded', 'code', 'sticker', 'game')
    .default('text'),
  body: Joi.when('type', {
    switch: [
      {
        is: 'code',
        then: Joi.string().max(20000).required(),
      },
      {
        is: 'text',
        then: Joi.string().max(10000).required(),
      },
    ],
    otherwise: Joi.string().max(10000).allow(null, ''),
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
  body_format: Joi.string().valid('plain', 'markdown', 'html').optional(),
});

const reactionDto = Joi.object({
  emoji: Joi.string().max(10).required(),
});

const saveMessageDto = Joi.object({
  note: Joi.string().max(2000).allow(null, ''),
});

const draftDto = Joi.object({
  body: Joi.string().max(10000).allow(null, ''),
  reply_to_id: Joi.string().uuid().allow(null),
  pending_attachments: Joi.array().items(Joi.object()).default([]),
}).min(1);

const forwardDto = Joi.object({
  conversation_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
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
  saveMessageDto,
  draftDto,
  forwardDto,
};
