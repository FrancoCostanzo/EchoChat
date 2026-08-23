import BaseRepository from './base.repository';
import { encrypt, decrypt } from '../utils/crypto.util';
import type { Row } from '../types/rows';
// El tipo con las columnas que agrega el JOIN lo declara el modelo, como en el
// resto de los repositorios (ver draft.repository).
import type { ReminderRow } from '../models/scheduled.model';

type ScheduledRow = Row<'scheduled_messages'>;

/**
 * Mensajes que esperan su hora para salir. El body va cifrado igual que el de
 * `messages` (ver utils/crypto.util) y se descifra al leer.
 */
class ScheduledMessageRepository extends BaseRepository<ScheduledRow> {
  constructor() {
    super('scheduled_messages');
  }

  _descifrar<T extends ScheduledRow | undefined>(row: T): T {
    if (row) row.body = decrypt(row.body) as string;
    return row;
  }

  async create(
    { conversation_id, sender_id, body, body_format, scheduled_at }: {
      conversation_id: string;
      sender_id: string;
      body: string;
      body_format?: string;
      scheduled_at: Date | string;
    },
  ): Promise<ScheduledRow> {
    const { rows } = await this.query(
      `INSERT INTO scheduled_messages (conversation_id, sender_id, body, body_format, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [conversation_id, sender_id, encrypt(body), body_format || 'plain', scheduled_at]
    );
    return this._descifrar(rows[0]);
  }

  /** Programados de un usuario: primero los que todavía no salieron. */
  async findByUser(userId: string, limit = 50): Promise<ScheduledRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM scheduled_messages
        WHERE sender_id = $1
        ORDER BY (status = 'pending') DESC, scheduled_at ASC
        LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r) => this._descifrar(r));
  }

  /**
   * Toma los vencidos marcándolos en la misma sentencia: si dos instancias
   * corren el job a la vez, el mensaje sale una sola vez.
   */
  async tomarVencidos(limit = 50): Promise<ScheduledRow[]> {
    const { rows } = await this.query(
      `UPDATE scheduled_messages SET status = 'sending', updated_at = NOW()
        WHERE id IN (
          SELECT id FROM scheduled_messages
           WHERE status = 'pending' AND scheduled_at <= NOW()
           ORDER BY scheduled_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [limit]
    );
    return rows.map((r) => this._descifrar(r));
  }

  async marcarEnviado(id: string, messageId: string): Promise<void> {
    await this.query(
      `UPDATE scheduled_messages
          SET status = 'sent', sent_message_id = $2, error = NULL, updated_at = NOW()
        WHERE id = $1`,
      [id, messageId]
    );
  }

  async marcarFallido(id: string, motivo: string): Promise<void> {
    await this.query(
      `UPDATE scheduled_messages SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`,
      [id, motivo.slice(0, 500)]
    );
  }

  /** Cancelar sólo tiene sentido mientras no haya salido; devuelve la fila si canceló. */
  async cancelar(id: string, userId: string): Promise<ScheduledRow | undefined> {
    const { rows } = await this.query(
      `UPDATE scheduled_messages SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND sender_id = $2 AND status = 'pending'
        RETURNING *`,
      [id, userId]
    );
    return this._descifrar(rows[0]);
  }
}

/** Avisos que un usuario se pone a sí mismo sobre un mensaje. */
class ReminderRepository extends BaseRepository<ReminderRow> {
  constructor() {
    super('message_reminders');
  }

  async create(
    { user_id, message_id, conversation_id, remind_at, note }: {
      user_id: string;
      message_id: string;
      conversation_id: string;
      remind_at: Date | string;
      note?: string | null;
    },
  ): Promise<ReminderRow> {
    const { rows } = await this.query(
      `INSERT INTO message_reminders (user_id, message_id, conversation_id, remind_at, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, message_id, conversation_id, remind_at, note || null]
    );
    return rows[0];
  }

  async findByUser(userId: string, limit = 50): Promise<ReminderRow[]> {
    const { rows } = await this.query(
      `SELECT r.*, m.body AS message_body, u.display_name AS message_sender_display_name
         FROM message_reminders r
         JOIN messages m ON m.id = r.message_id
         LEFT JOIN users u ON u.id = m.sender_id
        WHERE r.user_id = $1
        ORDER BY (r.status = 'pending') DESC, r.remind_at ASC
        LIMIT $2`,
      [userId, limit]
    );
    // El body del mensaje referenciado también viene cifrado.
    for (const row of rows) row.message_body = decrypt(row.message_body);
    return rows;
  }

  async tomarVencidos(limit = 100): Promise<ReminderRow[]> {
    const { rows } = await this.query(
      `UPDATE message_reminders SET status = 'done'
        WHERE id IN (
          SELECT id FROM message_reminders
           WHERE status = 'pending' AND remind_at <= NOW()
           ORDER BY remind_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [limit]
    );
    return rows;
  }

  async cancelar(id: string, userId: string): Promise<ReminderRow | undefined> {
    const { rows } = await this.query(
      `UPDATE message_reminders SET status = 'cancelled'
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING *`,
      [id, userId]
    );
    return rows[0];
  }
}

export const scheduledMessageRepository = new ScheduledMessageRepository();
export const reminderRepository = new ReminderRepository();
