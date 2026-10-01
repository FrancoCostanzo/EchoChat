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
  call_privacy?: 'everyone' | 'contacts' | 'nobody';
  call_dnd_behavior?: 'reject' | 'silent';
  ringtone_volume?: number;
  join_muted?: boolean;
  join_camera_off?: boolean;
  noise_suppression?: boolean;
  echo_cancellation?: boolean;
  auto_gain_control?: boolean;
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
  call_privacy: Joi.string().valid('everyone', 'contacts', 'nobody'),
  call_dnd_behavior: Joi.string().valid('reject', 'silent'),
  ringtone_volume: Joi.number().integer().min(0).max(100),
  join_muted: Joi.boolean(),
  join_camera_off: Joi.boolean(),
  noise_suppression: Joi.boolean(),
  echo_cancellation: Joi.boolean(),
  auto_gain_control: Joi.boolean(),
}).min(1);

export interface PushSubscribeRequest {
  endpoint: string;
  /** Viene en el JSON del navegador; no se usa. */
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/** Lo que entrega `PushSubscription.toJSON()` en el navegador. */
export const pushSubscribeDto = Joi.object<PushSubscribeRequest>({
  endpoint: Joi.string().uri({ scheme: ['https', 'http'] }).max(2000).required(),
  expirationTime: Joi.any(),
  keys: Joi.object({
    p256dh: Joi.string().max(200).required(),
    auth: Joi.string().max(100).required(),
  }).required(),
});

export const pushUnsubscribeDto = Joi.object<{ endpoint: string }>({
  endpoint: Joi.string().max(2000).required(),
});

export const pushActionDto = Joi.object<{ token: string }>({
  token: Joi.string().max(2000).required(),
});
