import { sql } from 'kysely';
import BaseRepository from './base.repository';
import { now, nowPlus, nowMinus, nowPlusPowerOfTwoMinutes, json, jsonText, asText } from '../config/db/sql';
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
    const row = await this.db.insertInto('email_outbox')
      .values({ user_id: userId, to_address: to, template, locale, data: json(data) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as EmailOutboxRow;
  }

  /**
   * Toma un lote de pendientes y les corre `send_after` para que otra
   * instancia que corra el job al mismo tiempo no los mande de nuevo.
   */
  async claimPending(limit: number, leaseSeconds: number): Promise<EmailOutboxRow[]> {
    return this.db.updateTable('email_outbox')
      .set({ send_after: nowPlus(leaseSeconds, 'seconds') })
      .where('id', 'in', (eb) => eb.selectFrom('email_outbox').select('id')
        .where('status', '=', 'pending')
        .where('send_after', '<=', now())
        .orderBy('send_after')
        .limit(limit)
        .forUpdate()
        .skipLocked())
      .returningAll()
      .execute() as Promise<EmailOutboxRow[]>;
  }

  /** Enviado: se vacía `data`, que puede tener links con token. */
  async markSent(id: string): Promise<void> {
    await this.db.updateTable('email_outbox')
      .set({ status: 'sent', sent_at: now(), data: json({}), last_error: null })
      .where('id', '=', id)
      .execute();
  }

  /** Reintento con espera creciente; pasado el tope queda como fallido (y sin datos). */
  async markFailed(id: string, error: string, maxAttempts: number): Promise<void> {
    await this.db.updateTable('email_outbox')
      .set((eb) => {
        const exhausted = eb(eb('attempts', '+', 1), '>=', maxAttempts);
        return {
          attempts: eb('attempts', '+', 1),
          last_error: error.slice(0, 1000),
          status: eb.case().when(exhausted).then('failed').else('pending').end(),
          data: eb.case().when(exhausted).then(json({})).else(eb.ref('data')).end(),
          // Espera de 2^intentos minutos.
          send_after: nowPlusPowerOfTwoMinutes(sql<number>`attempts + 1`),
        };
      })
      .where('id', '=', id)
      .execute();
  }

  async listRecent(limit: number): Promise<EmailLogRow[]> {
    return this.db.selectFrom('email_outbox as o')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .select([
        'o.id', 'o.user_id', 'o.to_address', 'o.template', 'o.locale', 'o.status', 'o.attempts',
        'o.send_after', 'o.sent_at', 'o.last_error', 'o.created_at', 'u.username',
      ])
      .orderBy('o.created_at', 'desc')
      .limit(limit)
      .execute() as unknown as Promise<EmailLogRow[]>;
  }

  // ── Tokens de contraseña ────────────────────────────────────────────────

  async createPasswordToken(
    userId: string, tokenHash: string, purpose: 'reset' | 'invite', ttlMinutes: number,
  ): Promise<void> {
    // Un token nuevo invalida los anteriores del mismo tipo: sólo sirve el último link.
    await this.db.updateTable('password_tokens')
      .set({ used_at: now() })
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('used_at', 'is', null)
      .execute();
    await this.db.insertInto('password_tokens')
      .values({ user_id: userId, token_hash: tokenHash, purpose, expires_at: nowPlus(ttlMinutes, 'minutes') })
      .execute();
  }

  /** Marca el token como usado y lo devuelve, sólo si estaba vigente (atómico). */
  async consumePasswordToken(tokenHash: string): Promise<PasswordTokenRow | null> {
    const row = await this.db.updateTable('password_tokens')
      .set({ used_at: now() })
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', now())
      .returningAll()
      .executeTakeFirst();
    return (row as PasswordTokenRow | undefined) ?? null;
  }

  async findValidPasswordToken(tokenHash: string): Promise<PasswordTokenRow | null> {
    const row = await this.db.selectFrom('password_tokens').selectAll()
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', now())
      .executeTakeFirst();
    return (row as PasswordTokenRow | undefined) ?? null;
  }

  // ── Avisos de pendientes ────────────────────────────────────────────────

  /**
   * Notificaciones cuyo email venció y siguen pendientes. Se descartan las que
   * el usuario ya vio de otra forma: marcadas como leídas, o del chat que leyó
   * después de que llegaran.
   */
  async takeDueNotifications(limit: number): Promise<DueNotificationRow[]> {
    return this.db.updateTable('notifications as n')
      .set({ emailed_at: now() })
      .where('n.id', 'in', (eb) => eb.selectFrom('notifications as n2')
        .leftJoin('conversation_members as cm', (j) => j
          .onRef('cm.user_id', '=', 'n2.recipient_id')
          .on(asText('cm.conversation_id'), '=', jsonText('n2.reference_data', 'conversation_id')))
        .select('n2.id')
        .where('n2.email_due_at', '<=', now())
        .where('n2.emailed_at', 'is', null)
        .where('n2.is_read', '=', false)
        .where((w) => w.or([w('cm.last_read_at', 'is', null), w('cm.last_read_at', '<', w.ref('n2.created_at'))]))
        .orderBy('n2.email_due_at')
        .limit(limit)
        .forUpdate('n2')
        .skipLocked())
      .returning(['n.id', 'n.recipient_id', 'n.type', 'n.title', 'n.reference_data', 'n.created_at'])
      .execute() as unknown as Promise<DueNotificationRow[]>;
  }

  async setNotificationEmailDue(notificationId: string, delayMinutes: number): Promise<void> {
    await this.db.updateTable('notifications')
      .set({ email_due_at: nowPlus(delayMinutes, 'minutes') })
      .where('id', '=', notificationId)
      .execute();
  }

  /**
   * Chats con mensajes sin leer (de otros, fuera de hilos) más viejos que
   * `minAgeMinutes`, que no generaron email desde la última vez que se leyeron.
   */
  async findUnreadConversations(minAgeMinutes: number, limit: number): Promise<UnreadConversationRow[]> {
    return this.db.selectFrom('conversation_members as cm')
      .innerJoin('conversations as c', 'c.id', 'cm.conversation_id')
      .innerJoin('users as me', (j) => j
        .onRef('me.id', '=', 'cm.user_id')
        .on('me.email', 'is not', null)
        .on('me.status', '=', 'active'))
      .innerJoin('messages as m', (j) => j
        .onRef('m.conversation_id', '=', 'cm.conversation_id')
        .on((o) => o('m.sent_at', '>', o.fn.coalesce('cm.last_read_at', 'cm.joined_at')))
        .onRef('m.sender_id', '<>', 'cm.user_id')
        .on('m.is_deleted', '=', false)
        .on('m.thread_id', 'is', null))
      .select((eb) => [
        'cm.user_id',
        'cm.conversation_id',
        'c.type as conversation_type',
        'c.name as conversation_name',
        eb.selectFrom('conversation_members as o')
          .innerJoin('users as u', 'u.id', 'o.user_id')
          .select('u.display_name')
          .whereRef('o.conversation_id', '=', 'c.id')
          .whereRef('o.user_id', '<>', 'cm.user_id')
          .where('c.type', '=', 'direct')
          .limit(1)
          .as('peer_name'),
        eb.cast<number>(eb.fn.count('m.id'), 'integer').as('unread'),
        eb.fn.min('m.sent_at').as('oldest_unread_at'),
      ])
      .where('cm.left_at', 'is', null)
      .where((w) => w.or([
        w('cm.unread_email_at', 'is', null),
        w('cm.unread_email_at', '<', w.fn.coalesce('cm.last_read_at', 'cm.joined_at')),
      ]))
      .groupBy(['cm.user_id', 'cm.conversation_id', 'c.id'])
      .having((h) => h(h.fn.min('m.sent_at'), '<', nowMinus(minAgeMinutes, 'minutes')))
      .limit(limit)
      .execute() as unknown as Promise<UnreadConversationRow[]>;
  }

  async markConversationsEmailed(userId: string, conversationIds: string[]): Promise<void> {
    if (conversationIds.length === 0) return;
    await this.db.updateTable('conversation_members')
      .set({ unread_email_at: now() })
      .where('user_id', '=', userId)
      .where('conversation_id', 'in', conversationIds)
      .execute();
  }

  // ── Resumen periódico ───────────────────────────────────────────────────

  /** Usuarios con resumen activo y email, con lo necesario para decidir si toca. */
  async findDigestCandidates(): Promise<DigestCandidateRow[]> {
    return this.db.selectFrom('user_notification_settings as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .select([
        's.user_id', 'u.email', 'u.locale', 's.email_locale', 'u.timezone',
        's.email_digest', 's.email_digest_hour', 's.last_digest_at',
      ])
      .where('s.email_digest', '<>', 'off')
      .where('u.email', 'is not', null)
      .where('u.status', '=', 'active')
      .execute() as unknown as Promise<DigestCandidateRow[]>;
  }

  /** Chats con mensajes sin leer de un usuario, para el resumen. */
  async unreadSummary(userId: string): Promise<UnreadSummaryRow[]> {
    return this.db.selectFrom('conversation_members as cm')
      .innerJoin('conversations as c', 'c.id', 'cm.conversation_id')
      .innerJoin('messages as m', (j) => j
        .onRef('m.conversation_id', '=', 'cm.conversation_id')
        .on((o) => o('m.sent_at', '>', o.fn.coalesce('cm.last_read_at', 'cm.joined_at')))
        .on('m.sender_id', '<>', userId)
        .on('m.is_deleted', '=', false)
        .on('m.thread_id', 'is', null))
      .select((eb) => [
        'cm.conversation_id',
        eb.fn.coalesce(
          'c.name',
          eb.selectFrom('conversation_members as o')
            .innerJoin('users as u', 'u.id', 'o.user_id')
            .select('u.display_name')
            .whereRef('o.conversation_id', '=', 'c.id')
            .where('o.user_id', '<>', userId)
            .limit(1),
        ).as('name'),
        eb.cast<number>(eb.fn.count('m.id'), 'integer').as('unread'),
      ])
      .where('cm.user_id', '=', userId)
      .where('cm.left_at', 'is', null)
      .groupBy(['cm.conversation_id', 'c.id'])
      .orderBy('unread', 'desc')
      .limit(20)
      .execute() as unknown as Promise<UnreadSummaryRow[]>;
  }

  async markDigestSent(userId: string): Promise<void> {
    await this.db.updateTable('user_notification_settings')
      .set({ last_digest_at: now() })
      .where('user_id', '=', userId)
      .execute();
  }
}

export default new EmailRepository();
