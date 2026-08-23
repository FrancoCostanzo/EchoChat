import Joi from 'joi';

export interface RelationshipRequest {
  target_user_id: string;
  type: 'contact' | 'blocked' | 'favorite';
  alias?: string | null;
}

export const relationshipDto = Joi.object<RelationshipRequest>({
  target_user_id: Joi.string().uuid().required(),
  type: Joi.string().valid('contact', 'blocked', 'favorite').required(),
  alias: Joi.string().max(100).allow(null, ''),
});
