const Joi = require('joi');

const CATEGORIES = ['announcements', 'department', 'project', 'general'];
const POST_RESTRICTIONS = ['members', 'admins_only', 'owner_only'];
const JOIN_MODES = ['open', 'invite_only', 'request'];

const createChannelDto = Joi.object({
  name: Joi.string().max(200).required(),
  description: Joi.string().allow(null, ''),
  topic: Joi.string().max(300).allow(null, ''),
  category: Joi.string().valid(...CATEGORIES).allow(null),
  is_official: Joi.boolean().default(false),
  post_restriction: Joi.string().valid(...POST_RESTRICTIONS).default('members'),
  join_mode: Joi.string().valid(...JOIN_MODES).default('open'),
  is_discoverable: Joi.boolean().default(true),
  max_members: Joi.number().integer().positive().allow(null),
  // Optional seed members beyond the creator (who becomes owner)
  member_ids: Joi.array().items(Joi.string().uuid()).default([]),
});

const updateChannelSettingsDto = Joi.object({
  category: Joi.string().valid(...CATEGORIES).allow(null),
  is_official: Joi.boolean(),
  post_restriction: Joi.string().valid(...POST_RESTRICTIONS),
  join_mode: Joi.string().valid(...JOIN_MODES),
}).min(1);

const joinChannelDto = Joi.object({
  message: Joi.string().max(500).allow(null, ''),
});

const reviewJoinRequestDto = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
});

module.exports = {
  createChannelDto,
  updateChannelSettingsDto,
  joinChannelDto,
  reviewJoinRequestDto,
};
