import Joi from 'joi';

const CATEGORIES = ['announcements', 'department', 'project', 'general'] as const;
const POST_RESTRICTIONS = ['members', 'admins_only', 'owner_only'] as const;
const JOIN_MODES = ['open', 'invite_only', 'request'] as const;

export type ChannelCategory = (typeof CATEGORIES)[number];
export type PostRestriction = (typeof POST_RESTRICTIONS)[number];
export type JoinMode = (typeof JOIN_MODES)[number];

export interface CreateChannelRequest {
  name: string;
  description?: string | null;
  topic?: string | null;
  category?: ChannelCategory | null;
  is_official?: boolean;
  post_restriction?: PostRestriction;
  join_mode?: JoinMode;
  is_discoverable?: boolean;
  max_members?: number | null;
  /** Miembros iniciales además del creador, que queda como owner. */
  member_ids?: string[];
}

export const createChannelDto = Joi.object<CreateChannelRequest>({
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

export interface UpdateChannelSettingsRequest {
  category?: ChannelCategory | null;
  is_official?: boolean;
  post_restriction?: PostRestriction;
  join_mode?: JoinMode;
}

export const updateChannelSettingsDto = Joi.object<UpdateChannelSettingsRequest>({
  category: Joi.string().valid(...CATEGORIES).allow(null),
  is_official: Joi.boolean(),
  post_restriction: Joi.string().valid(...POST_RESTRICTIONS),
  join_mode: Joi.string().valid(...JOIN_MODES),
}).min(1);

export interface JoinChannelRequest {
  message?: string | null;
}

export const joinChannelDto = Joi.object<JoinChannelRequest>({
  message: Joi.string().max(500).allow(null, ''),
});

export interface ReviewJoinRequestRequest {
  status: 'approved' | 'rejected';
}

export const reviewJoinRequestDto = Joi.object<ReviewJoinRequestRequest>({
  status: Joi.string().valid('approved', 'rejected').required(),
});
