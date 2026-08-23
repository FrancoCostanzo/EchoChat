/**
 * Contrato de /notifications. Sin model.ts propio en el backend (ver la nota
 * en types/broadcast.ts) — sólo se tipa el request
 * (backend/src/dtos/notification.dto.ts). Ver la nota de sincronización en
 * types/user.ts.
 */
export interface NotificationPrefsRequest {
  event_type: string;
  in_app_enabled?: boolean;
  push_enabled?: boolean;
  email_enabled?: boolean;
  /** Formato HH:MM. */
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

/** GET/PUT /notifications/preferences. Fuente: backend/src/types/db.d.ts (NotificationPreferences). */
export interface NotificationPreferenceResponse {
  user_id: string;
  event_type: string;
  in_app_enabled: boolean | null;
  push_enabled: boolean | null;
  email_enabled: boolean | null;
  quiet_days: number[] | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}
