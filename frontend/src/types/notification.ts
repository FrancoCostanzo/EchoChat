/**
 * Contrato de /notifications. Sin model.ts propio en el backend (ver la nota
 * en types/broadcast.ts) — se tipa contra backend/src/dtos/notification.dto.ts
 * y notificationService. Ver la nota de sincronización en types/user.ts.
 */

/** Fuente: backend/src/utils/notificationEvents.ts. */
export type NotificationEvent =
  | 'message.direct'
  | 'message.group'
  | 'message.mention'
  | 'thread.reply'
  | 'message.reaction'
  | 'call.incoming'
  | 'call.missed'
  | 'broadcast'
  | 'channel.join_request'
  | 'reminder'
  | 'security.alert';

export interface NotificationPrefsRequest {
  event_type: NotificationEvent;
  in_app_enabled?: boolean;
  push_enabled?: boolean;
  email_enabled?: boolean;
}

/** Una fila de la matriz evento × canal, ya resuelta por el backend. */
export interface NotificationPreferenceResponse {
  event_type: NotificationEvent;
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  /** Bloqueado por el admin: el usuario no lo puede cambiar. */
  locked: boolean;
}

/** GET /notifications/preferences. */
export interface NotificationPreferencesResponse {
  events: NotificationPreferenceResponse[];
  /** Canales habilitados en la instancia. */
  channels: { push: boolean; email: boolean };
  /** Defaults de la instancia (los del código pisados por `notification_defaults`). */
  defaults: Record<NotificationEvent, { in_app: boolean; push: boolean; email: boolean }>;
}

export type PushPreview = 'full' | 'sender' | 'none';
export type PushWhen = 'always' | 'inactive';
export type EmailDigest = 'off' | 'hourly' | 'daily' | 'weekly';

/** GET/PUT /notifications/settings. Fuente: notificationService.getSettings. */
export interface NotificationSettings {
  dnd_enabled: boolean;
  dnd_until: string | null;
  /** Formato HH:MM(:SS). */
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  /** 0 = domingo … 6 = sábado. */
  quiet_days: number[];
  push_preview: PushPreview;
  push_when: PushWhen;
  sound_enabled: boolean;
  sound_name: string;
  sound_volume: number;
  ringtone_name: string;
  badge_enabled: boolean;
  email_digest: EmailDigest;
  email_digest_hour: number;
  email_unread_delay_minutes: 15 | 30 | 60 | 120;
  email_locale: string | null;
}

export type NotificationSettingsRequest = Partial<NotificationSettings>;

/** Un navegador/dispositivo suscripto a push. Fuente: push.service toDevice. */
export interface PushDevice {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  /** Final del endpoint, para reconocer el navegador actual en la lista. */
  endpoint_tail: string;
}

/** Nivel de aviso de un chat (conversation_members.notification_level). */
export type NotificationLevel = 'all' | 'mentions' | 'none';
