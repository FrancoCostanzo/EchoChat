const Joi = require('joi');

const createConversationDto = Joi.object({
  type: Joi.string().valid('direct', 'group', 'channel', 'broadcast', 'bot').required(),
  name: Joi.string().max(200).when('type', {
    is: Joi.valid('group', 'channel'),
    then: Joi.required(),
    otherwise: Joi.allow(null, ''),
  }),
  description: Joi.string().allow(null, ''),
  topic: Joi.string().max(300).allow(null, ''),
  is_discoverable: Joi.boolean().default(true),
  max_members: Joi.number().integer().positive().allow(null),
  member_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const updateConversationDto = Joi.object({
  name: Joi.string().max(200),
  description: Joi.string().allow(null, ''),
  topic: Joi.string().max(300).allow(null, ''),
  is_archived: Joi.boolean(),
  is_read_only: Joi.boolean(),
  is_discoverable: Joi.boolean(),
  max_members: Joi.number().integer().positive().allow(null),
}).min(1);

const addMembersDto = Joi.object({
  member_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const updateMemberDto = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'moderator', 'member', 'viewer'),
  is_muted: Joi.boolean(),
  muted_until: Joi.date().iso().allow(null),
  is_pinned: Joi.boolean(),
  is_hidden: Joi.boolean(),
}).min(1);

module.exports = {
  createConversationDto,
  updateConversationDto,
  addMembersDto,
  updateMemberDto,
};
