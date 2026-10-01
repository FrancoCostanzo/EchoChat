import BaseRepository from './base.repository';
import type { Row } from '../types/rows';

export type EmailOutboxRow = Row<'email_outbox'>;
export type PasswordTokenRow = Row<'password_tokens'>;

/** Una notificación cuyo aviso por email ya venció y sigue sin leer. */
export interface DueNotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string | null;
  reference_data: Record<string, unknown> | null;
  created_at: Date;
}

/** Chat con mensajes sin leer que todavía no generó email en esta racha. */
export interface UnreadConversationRow {
  user_id: string;
  conversation_id: string;
  conversation_type: string;
  conversation_name: string | null;
  /** En directos, el nombre del otro. */
  peer_name: string | null;
  unread: number;
  oldest_unread_at: Date;
}

export type EmailLogRow = Omit<EmailOutboxRow, 'data'> & { username: string | null };

export interface DigestCandidateRow {
  user_id: string;
  email: string;
  locale: string | null;
  email_locale: string | null;
  timezone: string | null;
  email_digest: string;
  email_digest_hour: number;
  last_digest_at: Date | null;
}

export interface UnreadSummaryRow {
  conversation_id: string;
  name: string | null;
  unread: number;
}

class EmailRepository extends BaseRepository<EmailOutboxRow> {
  constructor() {
    super('email_outbox');
  }

  // ── Cola ────────────────────────────────────────────────────────────────

  async enqueue(
    { userId, to, template, locale, data }: {
      userId: string | null; to: string; template: string; locale: string; data: Record<string, unknown>;
    },
  ): Promise<EmailOutboxRow> {
    const { rows } = await this.query<EmailOutboxRow>(
      `INSERT INTO email_outbox (user_id, to_address, template, locale, data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, to, template, locale, JSON.stringify(data)]
    );
    return rows[0];
  }

  /**
   * Toma un lote de pendientes y les corre `send_after` para que otra
   * instancia que corra el job al mismo tiempo no los mande de nuevo.
   */
  async claimPending(limit: number, leaseSeconds: number): Promise<EmailOutboxRow[]> {
    const { rows } = await this.query<EmailOutboxRow>(
      `UPDATE email_outbox SET send_after = NOW() + make_interval(secs => $2)
       WHERE id IN (
         SELECT id FROM email_outbox
         WHERE status = 'pending' AND send_after <= NOW()
         ORDER BY send_after
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit, leaseSeconds]
    );
    return rows;
  }

  /** Enviado: se vacía `data`, que puede tener links con token. */
  async markSent(id: string): Promise<void> {
    await this.query(
      `UPDATE email_outbox SET status = 'sent', sent_at = NOW(), data = '{}', last_error = NULL WHERE id = $1`,
      [id]
    );
  }

  /** Reintento con espera creciente; pasado el tope queda como fallido (y sin datos). */
  async markFailed(id: string, error: string, maxAttempts: number): Promise<void> {
    await this.query(
      `UPDATE email_outbox
       SET attempts = attempts + 1,
           last_error = $2,
           status = CASE WHEN attempts + 1 >= $3 THEN 'failed' ELSE 'pending' END,
           data = CASE WHEN attempts + 1 >= $3 THEN '{}'::jsonb ELSE data END,
           send_after = NOW() + make_interval(mins => POWER(2, attempts + 1)::int)
       WHERE id = $1`,
      [id, error.slice(0, 1000), maxAttempts]
    );
  }

  async listRecent(limit: number): Promise<EmailLogRow[]> {
    const { rows } = await this.query<EmailLogRow>(
      `SELECT o.id, o.user_id, o.to_address, o.template, o.locale, o.status, o.attempts,
              o.send_after, o.sent_at, o.last_error, o.created_at, u.username
       FROM email_outbox o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  // ── Tokens de contraseña ────────────────────────────────────────────────

  async createPasswordToken(
    userId: string, tokenHash: string, purpose: 'reset' | 'invite', ttlMinutes: number,
  ): Promise<void> {
    // Un token nuevo invalida los anteriores del mismo tipo: sólo sirve el último link.
    await this.query(
      `UPDATE password_tokens SET used_at = NOW()
       WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
      [userId, purpose]
    );
    await this.query(
      `INSERT INTO password_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
      [userId, tokenHash, purpose, ttlMinutes]
    );
  }

  /** Marca el token como usado y lo devuelve, sólo si estaba vigente (atómico). */
  async consumePasswordToken(tokenHash: string): Promise<PasswordTokenRow | null> {
    const { rows } = await this.query<PasswordTokenRow>(
      `UPDATE password_tokens SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING *`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async findValidPasswordToken(tokenHash: string): Promise<PasswordTokenRow | null> {
    const { rows } = await this.query<PasswordTokenRow>(
      `SELECT * FROM password_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  // ── Avisos de pendientes ────────────────────────────────────────────────

  /**
   * Notificaciones cuyo email venció y siguen pendientes. Se descartan las que
   * el usuario ya vio de otra forma: marcadas como leídas, o del chat que leyó
   * después de que llegaran.
   */
  async takeDueNotifications(limit: number): Promise<DueNotificationRow[]> {
    const { rows } = await this.query<DueNotificationRow>(
      `UPDATE notifications n SET emailed_at = NOW()
       WHERE n.id IN (
         SELECT n2.id FROM notifications n2
         LEFT JOIN conversation_members cm
           ON cm.user_id = n2.recipient_id
          AND cm.conversation_id::text = n2.reference_data->>'conversation_id'
         WHERE n2.email_due_at <= NOW()
           AND n2.emailed_at IS NULL
           AND n2.is_read = FALSE
           AND (cm.last_read_at IS NULL OR cm.last_read_at < n2.created_at)
         ORDER BY n2.email_due_at
         LIMIT $1
         FOR UPDATE OF n2 SKIP LOCKED
       )
       RETURNING n.id, n.recipient_id, n.type, n.title, n.reference_data, n.created_at`,
      [limit]
    );
    return rows;
  }

  async setNotificationEmailDue(notificationId: string, delayMinutes: number): Promise<void> {
    await this.query(
      `UPDATE notifications SET email_due_at = NOW() + make_interval(mins => $2) WHERE id = $1`,
      [notificationId, delayMinutes]
    );
  }

  /**
   * Chats con mensajes sin leer (de otros, fuera de hilos) más viejos que
   * `minAgeMinutes`, que no generaron email desde la última vez que se leyeron.
   */
  async findUnreadConversations(minAgeMinutes: number, limit: number): Promise<UnreadConversationRow[]> {
    const { rows } = await this.query<UnreadConversationRow>(
      `SELECT cm.user_id, cm.conversation_id, c.type AS conversation_type, c.name AS conversation_name,
              (SELECT u.display_name FROM conversation_members o JOIN users u ON u.id = o.user_id
                WHERE o.conversation_id = c.id AND o.user_id <> cm.user_id AND c.type = 'direct'
                LIMIT 1) AS peer_name,
              COUNT(m.id)::int AS unread,
              MIN(m.sent_at) AS oldest_unread_at
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       JOIN users me ON me.id = cm.user_id AND me.email IS NOT NULL AND me.status = 'active'
       JOIN messages m ON m.conversation_id = cm.conversation_id
                      AND m.sent_at > COALESCE(cm.last_read_at, cm.joined_at)
                      AND m.sender_id <> cm.user_id
                      AND m.is_deleted = FALSE
                      AND m.thread_id IS NULL
       WHERE cm.left_at IS NULL
         AND (cm.unread_email_at IS NULL OR cm.unread_email_at < COALESCE(cm.last_read_at, cm.joined_at))
       GROUP BY cm.user_id, cm.conversation_id, c.id
       HAVING MIN(m.sent_at) < NOW() - make_interval(mins => $1)
       LIMIT $2`,
      [minAgeMinutes, limit]
    );
    return rows;
  }

  async markConversationsEmailed(userId: string, conversationIds: string[]): Promise<void> {
    if (conversationIds.length === 0) return;
    await this.query(
      `UPDATE conversation_members SET unread_email_at = NOW()
       WHERE user_id = $1 AND conversation_id = ANY($2::uuid[])`,
      [userId, conversationIds]
    );
  }

  // ── Resumen periódico ───────────────────────────────────────────────────

  /** Usuarios con resumen activo y email, con lo necesario para decidir si toca. */
  async findDigestCandidates(): Promise<DigestCandidateRow[]> {
    const { rows } = await this.query<DigestCandidateRow>(
      `SELECT s.user_id, u.email, u.locale, s.email_locale, u.timezone,
              s.email_digest, s.email_digest_hour, s.last_digest_at
       FROM user_notification_settings s
       JOIN users u ON u.id = s.user_id
       WHERE s.email_digest <> 'off' AND u.email IS NOT NULL AND u.status = 'active'`
    );
    return rows;
  }

  /** Chats con mensajes sin leer de un usuario, para el resumen. */
  async unreadSummary(userId: string): Promise<UnreadSummaryRow[]> {
    const { rows } = await this.query<UnreadSummaryRow>(
      `SELECT cm.conversation_id,
              COALESCE(c.name, (SELECT u.display_name FROM conversation_members o JOIN users u ON u.id = o.user_id
                                WHERE o.conversation_id = c.id AND o.user_id <> $1 LIMIT 1)) AS name,
              COUNT(m.id)::int AS unread
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       JOIN messages m ON m.conversation_id = cm.conversation_id
                      AND m.sent_at > COALESCE(cm.last_read_at, cm.joined_at)
                      AND m.sender_id <> $1
                      AND m.is_deleted = FALSE
                      AND m.thread_id IS NULL
       WHERE cm.user_id = $1 AND cm.left_at IS NULL
       GROUP BY cm.conversation_id, c.id
       ORDER BY unread DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  }

  async markDigestSent(userId: string): Promise<void> {
    await this.query(
      'UPDATE user_notification_settings SET last_digest_at = NOW() WHERE user_id = $1',
      [userId]
    );
  }
}

export default new EmailRepository();
