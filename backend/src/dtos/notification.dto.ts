import Joi from 'joi';
import { NOTIFICATION_EVENTS } from '../utils/notificationEvents';

export interface NotificationPrefsRequest {
  event_type: string;
  in_app_enabled?: boolean;
  push_enabled?: boolean;
  email_enabled?: boolean;
}

export const notificationPrefsDto = Joi.object<NotificationPrefsRequest>({
  event_type: Joi.string().valid(...NOTIFICATION_EVENTS).required(),
  in_app_enabled: Joi.boolean(),
  push_enabled: Joi.boolean(),
  email_enabled: Joi.boolean(),
});

export const SOUND_NAMES = ['ping', 'chime', 'pop', 'bubble', 'knock'] as const;
export const RINGTONE_NAMES = ['classic', 'soft', 'digital'] as const;

export interface NotificationSettingsRequest {
  dnd_enabled?: boolean;
  dnd_until?: string | null;
  /** Formato HH:MM. */
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_days?: number[];
  push_preview?: 'full' | 'sender' | 'none';
  push_when?: 'always' | 'inactive';
  sound_enabled?: boolean;
  sound_name?: string;
  sound_volume?: number;
  ringtone_name?: string;
  badge_enabled?: boolean;
  email_digest?: 'off' | 'hourly' | 'daily' | 'weekly';
  email_digest_hour?: number;
  email_unread_delay_minutes?: 15 | 30 | 60 | 120;
  email_locale?: string | null;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const notificationSettingsDto = Joi.object<NotificationSettingsRequest>({
  dnd_enabled: Joi.boolean(),
  dnd_until: Joi.date().iso().allow(null),
  quiet_hours_start: Joi.string().pattern(HORA).allow(null),
  quiet_hours_end: Joi.string().pattern(HORA).allow(null),
  quiet_days: Joi.array().items(Joi.number().integer().min(0).max(6)).unique().max(7),
  push_preview: Joi.string().valid('full', 'sender', 'none'),
  push_when: Joi.string().valid('always', 'inactive'),
  sound_enabled: Joi.boolean(),
  sound_name: Joi.string().valid(...SOUND_NAMES),
  sound_volume: Joi.number().integer().min(0).max(100),
  ringtone_name: Joi.string().valid(...RINGTONE_NAMES),
  badge_enabled: Joi.boolean(),
  email_digest: Joi.string().valid('off', 'hourly', 'daily', 'weekly'),
  email_digest_hour: Joi.number().integer().min(0).max(23),
  email_unread_delay_minutes: Joi.number().valid(15, 30, 60, 120),
  email_locale: Joi.string().valid('es', 'en', 'pt').allow(null),
}).min(1);
