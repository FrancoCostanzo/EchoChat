import Joi from 'joi';

/** POST /scheduled/messages — "mandá esto el lunes a las 9". */
export interface ScheduleMessageRequest {
  conversation_id: string;
  body: string;
  body_format?: 'plain' | 'markdown' | 'html';
  scheduled_at: Date | string;
}

export const scheduleMessageDto = Joi.object<ScheduleMessageRequest>({
  conversation_id: Joi.string().uuid().required(),
  body: Joi.string().max(10000).required(),
  body_format: Joi.string().valid('plain', 'markdown', 'html').default('plain'),
  // `greater('now')` evita programar en el pasado, que saldría en el próximo
  // tick del job y confundiría más que fallar acá.
  scheduled_at: Joi.date().iso().greater('now').required(),
});

/** POST /scheduled/reminders — "recordame este mensaje mañana". */
export interface CreateReminderRequest {
  message_id: string;
  remind_at: Date | string;
  note?: string | null;
}

export const createReminderDto = Joi.object<CreateReminderRequest>({
  message_id: Joi.string().uuid().required(),
  remind_at: Joi.date().iso().greater('now').required(),
  note: Joi.string().max(200).allow(null, ''),
});
