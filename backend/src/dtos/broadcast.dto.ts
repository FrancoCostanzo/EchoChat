import Joi from 'joi';

export interface CreateBroadcastListRequest {
  name: string;
  description?: string | null;
  recipient_ids: string[];
}

export const createBroadcastListDto = Joi.object<CreateBroadcastListRequest>({
  name: Joi.string().max(200).required(),
  description: Joi.string().allow(null, ''),
  recipient_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

export interface SendBroadcastRequest {
  body: string;
  type?: 'text' | 'media' | 'template';
  object_id?: string | null;
  scheduled_at?: Date | null;
}

export const sendBroadcastDto = Joi.object<SendBroadcastRequest>({
  body: Joi.string().max(10000).required(),
  type: Joi.string().valid('text', 'media', 'template').default('text'),
  object_id: Joi.string().uuid().allow(null),
  scheduled_at: Joi.date().iso().allow(null),
});

/** Se agrega por lista de ids o por departamento entero (al menos uno). */
export interface AddBroadcastRecipientsRequest {
  recipient_ids?: string[];
  department?: string | null;
}

export const addBroadcastRecipientsDto = Joi.object<AddBroadcastRecipientsRequest>({
  recipient_ids: Joi.array().items(Joi.string().uuid()).default([]),
  department: Joi.string().max(100).allow(null, ''),
}).or('recipient_ids', 'department');
