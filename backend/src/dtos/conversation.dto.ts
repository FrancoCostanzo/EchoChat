import Joi from 'joi';

export type ConversationType = 'direct' | 'group' | 'channel' | 'broadcast' | 'bot';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';

export interface CreateConversationRequest {
  type: ConversationType;
  /** Obligatorio para 'group' y 'channel'. */
  name?: string | null;
  description?: string | null;
  topic?: string | null;
  is_discoverable?: boolean;
  max_members?: number | null;
  member_ids: string[];
}

export const createConversationDto = Joi.object<CreateConversationRequest>({
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

export interface UpdateConversationRequest {
  name?: string;
  description?: string | null;
  topic?: string | null;
  is_archived?: boolean;
  is_read_only?: boolean;
  is_discoverable?: boolean;
  only_admins_edit_info?: boolean;
  max_members?: number | null;
}

export const updateConversationDto = Joi.object<UpdateConversationRequest>({
  name: Joi.string().max(200),
  description: Joi.string().allow(null, ''),
  topic: Joi.string().max(300).allow(null, ''),
  is_archived: Joi.boolean(),
  is_read_only: Joi.boolean(),
  is_discoverable: Joi.boolean(),
  only_admins_edit_info: Joi.boolean(),
  max_members: Joi.number().integer().positive().allow(null),
}).min(1);

export interface AddMembersRequest {
  member_ids: string[];
}

export const addMembersDto = Joi.object<AddMembersRequest>({
  member_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

export interface UpdateMemberRequest {
  role?: MemberRole;
  is_muted?: boolean;
  muted_until?: Date | null;
  is_pinned?: boolean;
  is_hidden?: boolean;
}

export const updateMemberDto = Joi.object<UpdateMemberRequest>({
  role: Joi.string().valid('owner', 'admin', 'moderator', 'member', 'viewer'),
  is_muted: Joi.boolean(),
  muted_until: Joi.date().iso().allow(null),
  is_pinned: Joi.boolean(),
  is_hidden: Joi.boolean(),
}).min(1);
