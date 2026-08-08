import Joi from 'joi';

export type MessageType =
  | 'text' | 'media' | 'location' | 'contact' | 'poll'
  | 'forwarded' | 'code' | 'sticker' | 'game';

export interface SendMessageRequest {
  conversation_id: string;
  type?: MessageType;
  /** Obligatorio para 'text' y 'code'; opcional en el resto. */
  body?: string | null;
  body_format?: 'plain' | 'markdown' | 'html';
  reply_to_id?: string | null;
  thread_id?: string | null;
  forwarded_from_id?: string | null;
  attachment_ids?: string[];
  metadata?: Record<string, unknown>;
}

export const sendMessageDto = Joi.object<SendMessageRequest>({
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

export interface UpdateMessageRequest {
  body: string;
  body_format?: 'plain' | 'markdown' | 'html';
}

export const updateMessageDto = Joi.object<UpdateMessageRequest>({
  body: Joi.string().max(10000).required(),
  body_format: Joi.string().valid('plain', 'markdown', 'html').optional(),
});

export interface ReactionRequest {
  emoji: string;
}

export const reactionDto = Joi.object<ReactionRequest>({
  emoji: Joi.string().max(10).required(),
});

export interface SaveMessageRequest {
  note?: string | null;
}

export const saveMessageDto = Joi.object<SaveMessageRequest>({
  note: Joi.string().max(2000).allow(null, ''),
});

export interface DraftRequest {
  body?: string | null;
  reply_to_id?: string | null;
  pending_attachments?: Record<string, unknown>[];
}

export const draftDto = Joi.object<DraftRequest>({
  body: Joi.string().max(10000).allow(null, ''),
  reply_to_id: Joi.string().uuid().allow(null),
  pending_attachments: Joi.array().items(Joi.object()).default([]),
}).min(1);

export interface ForwardRequest {
  conversation_ids: string[];
}

export const forwardDto = Joi.object<ForwardRequest>({
  conversation_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

export interface PaginationRequest {
  cursor?: string | null;
  limit?: number;
  direction?: 'before' | 'after';
}

export const paginationDto = Joi.object<PaginationRequest>({
  cursor: Joi.string().uuid().allow(null),
  limit: Joi.number().integer().min(1).max(100).default(50),
  direction: Joi.string().valid('before', 'after').default('before'),
});
