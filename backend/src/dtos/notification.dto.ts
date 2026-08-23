import Joi from 'joi';

export interface NotificationPrefsRequest {
  event_type: string;
  in_app_enabled?: boolean;
  push_enabled?: boolean;
  email_enabled?: boolean;
  /** Formato HH:MM. */
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export const notificationPrefsDto = Joi.object<NotificationPrefsRequest>({
  event_type: Joi.string().max(50).required(),
  in_app_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
  quiet_hours_start: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
  quiet_hours_end: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
});
