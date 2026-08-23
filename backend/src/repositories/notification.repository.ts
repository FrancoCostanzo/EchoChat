import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { NotificationPrefsRequest } from '../dtos/notification.dto';

type NotificationRow = Row<'notifications'>;
type PreferenceRow = Row<'notification_preferences'>;

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
    const { rows } = await this.query(
      `INSERT INTO notifications (recipient_id, type, title, body, reference_type, reference_id, reference_data, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [recipient_id, type, title || null, body || null,
       reference_type || null, reference_id || null, reference_data || {}, channel || 'in_app']
    );
    return rows[0];
  }

  async findByUser(
    userId: string,
    { limit = 30, offset = 0, unreadOnly = false }: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<NotificationRow[]> {
    const condition = unreadOnly ? 'AND is_read = FALSE' : '';
    const { rows } = await this.query(
      `SELECT * FROM notifications
       WHERE recipient_id = $1 ${condition}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow> {
    const { rows } = await this.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND recipient_id = $2 RETURNING *`,
      [id, userId]
    );
    return rows[0];
  }

  async markAllAsRead(userId: string): Promise<number | null> {
    const { rowCount } = await this.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return rowCount;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { rows } = await this.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(rows[0].count, 10);
  }

  /** Preferencia de un evento puntual; null si el usuario nunca la tocó. */
  async findPreference(userId: string, eventType: string): Promise<PreferenceRow | null> {
    const { rows } = await this.query<PreferenceRow>(
      `SELECT * FROM notification_preferences WHERE user_id = $1 AND event_type = $2`,
      [userId, eventType]
    );
    return rows[0] || null;
  }

  async getPreferences(userId: string): Promise<PreferenceRow[]> {
    const { rows } = await this.query<PreferenceRow>(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return rows;
  }

  async upsertPreference(userId: string, prefs: NotificationPrefsRequest): Promise<PreferenceRow> {
    const { rows } = await this.query<PreferenceRow>(
      `INSERT INTO notification_preferences (user_id, event_type, in_app_enabled, push_enabled, email_enabled, quiet_hours_start, quiet_hours_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, event_type) DO UPDATE
       SET in_app_enabled = COALESCE($3, notification_preferences.in_app_enabled),
           push_enabled = COALESCE($4, notification_preferences.push_enabled),
           email_enabled = COALESCE($5, notification_preferences.email_enabled),
           quiet_hours_start = COALESCE($6, notification_preferences.quiet_hours_start),
           quiet_hours_end = COALESCE($7, notification_preferences.quiet_hours_end)
       RETURNING *`,
      [userId, prefs.event_type, prefs.in_app_enabled ?? null, prefs.push_enabled ?? null,
       prefs.email_enabled ?? null, prefs.quiet_hours_start || null, prefs.quiet_hours_end || null]
    );
    return rows[0];
  }
}

export default new NotificationRepository();
