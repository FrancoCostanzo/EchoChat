import BaseRepository from './base.repository';
import { now, json } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { NotificationPrefsRequest, NotificationSettingsRequest } from '../dtos/notification.dto';

type NotificationRow = Row<'notifications'>;
type PreferenceRow = Row<'notification_preferences'>;
export type NotificationSettingsRow = Row<'user_notification_settings'>;

// Columnas de user_notification_settings que el usuario puede cambiar. La
// lista blanca arma el UPDATE dinámico sin interpolar nombres que vengan de afuera.
const SETTINGS_COLUMNS = [
  'dnd_enabled', 'dnd_until', 'quiet_hours_start', 'quiet_hours_end', 'quiet_days',
  'push_preview', 'push_when', 'sound_enabled', 'sound_name', 'sound_volume',
  'ringtone_name', 'badge_enabled', 'email_digest', 'email_digest_hour',
  'email_unread_delay_minutes', 'email_locale', 'call_privacy', 'call_dnd_behavior',
  'ringtone_volume', 'join_muted', 'join_camera_off', 'noise_suppression',
  'echo_cancellation', 'auto_gain_control',
] as const;

class NotificationRepository extends BaseRepository<NotificationRow> {
  constructor() {
    super('notifications');
  }

  async create(
    { recipient_id, type, title, body, reference_type, reference_id, reference_data, channel }: {
      recipient_id: string;
      type: string;
      title?: string | null;
      body?: string | null;
      reference_type?: string | null;
      reference_id?: string | null;
      reference_data?: unknown;
      channel?: string | null;
    },
  ): Promise<NotificationRow> {
    const row = await this.db.insertInto('notifications')
      .values({
        recipient_id,
        type,
        title: title || null,
        body: body || null,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        reference_data: json(reference_data || {}),
        channel: channel || 'in_app',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as NotificationRow;
  }

  async findByUser(
    userId: string,
    { limit = 30, offset = 0, unreadOnly = false }: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<NotificationRow[]> {
    let q = this.db.selectFrom('notifications').selectAll().where('recipient_id', '=', userId);
    if (unreadOnly) q = q.where('is_read', '=', false);
    return q.orderBy('created_at', 'desc').limit(limit).offset(offset).execute() as Promise<NotificationRow[]>;
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow> {
    const row = await this.db.updateTable('notifications')
      .set({ is_read: true, read_at: now() })
      .where('id', '=', id)
      .where('recipient_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row as NotificationRow;
  }

  async markAllAsRead(userId: string): Promise<number | null> {
    const result = await this.db.updateTable('notifications')
      .set({ is_read: true, read_at: now() })
      .where('recipient_id', '=', userId)
      .where('is_read', '=', false)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await this.db.selectFrom('notifications')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('recipient_id', '=', userId)
      .where('is_read', '=', false)
      .executeTakeFirstOrThrow();
    return parseInt(String(count), 10);
  }

  /** Preferencia de un evento puntual; null si el usuario nunca la tocó. */
  async findPreference(userId: string, eventType: string): Promise<PreferenceRow | null> {
    const row = await this.db.selectFrom('notification_preferences').selectAll()
      .where('user_id', '=', userId)
      .where('event_type', '=', eventType)
      .executeTakeFirst();
    return (row as PreferenceRow | undefined) ?? null;
  }

  async getPreferences(userId: string): Promise<PreferenceRow[]> {
    return this.db.selectFrom('notification_preferences').selectAll()
      .where('user_id', '=', userId)
      .execute() as Promise<PreferenceRow[]>;
  }

  async upsertPreference(userId: string, prefs: NotificationPrefsRequest): Promise<PreferenceRow> {
    const inApp = prefs.in_app_enabled ?? null;
    const push = prefs.push_enabled ?? null;
    const email = prefs.email_enabled ?? null;
    const row = await this.db.insertInto('notification_preferences')
      .values({ user_id: userId, event_type: prefs.event_type, in_app_enabled: inApp, push_enabled: push, email_enabled: email })
      // Lo que no vino en el pedido conserva el valor guardado.
      .onConflict((oc) => oc.columns(['user_id', 'event_type']).doUpdateSet((eb) => ({
        in_app_enabled: eb.fn.coalesce(eb.val(inApp), eb.ref('notification_preferences.in_app_enabled')),
        push_enabled: eb.fn.coalesce(eb.val(push), eb.ref('notification_preferences.push_enabled')),
        email_enabled: eb.fn.coalesce(eb.val(email), eb.ref('notification_preferences.email_enabled')),
      })))
      .returningAll()
      .executeTakeFirst();
    return row as PreferenceRow;
  }

  /** Configuración global del usuario; null si nunca la tocó (valen los defaults de la tabla). */
  async findSettings(userId: string): Promise<NotificationSettingsRow | null> {
    const row = await this.db.selectFrom('user_notification_settings').selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return (row as NotificationSettingsRow | undefined) ?? null;
  }

  /** Crea la fila con los defaults si no existe y aplica sólo los campos presentes. */
  async upsertSettings(userId: string, patch: NotificationSettingsRequest): Promise<NotificationSettingsRow> {
    const changes: Record<string, unknown> = {};
    for (const column of SETTINGS_COLUMNS) {
      if (patch[column] !== undefined) changes[column] = patch[column];
    }
    await this.db.insertInto('user_notification_settings')
      .values({ user_id: userId })
      .onConflict((oc) => oc.column('user_id').doNothing())
      .execute();
    const row = await this.db.updateTable('user_notification_settings')
      .set({ ...changes, updated_at: now() })
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row as NotificationSettingsRow;
  }
}

export default new NotificationRepository();
