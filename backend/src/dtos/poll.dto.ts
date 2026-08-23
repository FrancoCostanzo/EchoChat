import Joi from 'joi';

export interface CreatePollRequest {
  conversation_id: string;
  question: string;
  options: string[];
  is_anonymous?: boolean;
  is_multiple?: boolean;
  closes_at?: Date | null;
}

export const createPollDto = Joi.object<CreatePollRequest>({
  conversation_id: Joi.string().uuid().required(),
  question: Joi.string().max(500).required(),
  options: Joi.array().items(Joi.string().max(300)).min(2).max(10).required(),
  is_anonymous: Joi.boolean().default(false),
  is_multiple: Joi.boolean().default(false),
  closes_at: Joi.date().iso().allow(null),
});

export interface VoteRequest {
  option_ids: string[];
}

export const voteDto = Joi.object<VoteRequest>({
  option_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});
