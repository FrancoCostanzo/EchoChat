import BaseRepository from './base.repository';
import { encrypt, decrypt } from '../utils/crypto.util';
import { now } from '../config/db/sql';
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
    const row = await this.db.insertInto('scheduled_messages')
      .values({ conversation_id, sender_id, body: encrypt(body) as string, body_format: body_format || 'plain', scheduled_at })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this._descifrar(row as ScheduledRow);
  }

  /** Programados de un usuario: primero los que todavía no salieron. */
  async findByUser(userId: string, limit = 50): Promise<ScheduledRow[]> {
    const rows = await this.db.selectFrom('scheduled_messages').selectAll()
      .where('sender_id', '=', userId)
      .orderBy((eb) => eb.case().when('status', '=', 'pending').then(1).else(0).end(), 'desc')
      .orderBy('scheduled_at', 'asc')
      .limit(limit)
      .execute();
    return (rows as ScheduledRow[]).map((r) => this._descifrar(r));
  }

  /**
   * Toma los vencidos marcándolos en la misma sentencia: si dos instancias
   * corren el job a la vez, el mensaje sale una sola vez.
   */
  async tomarVencidos(limit = 50): Promise<ScheduledRow[]> {
    const rows = await this.db.updateTable('scheduled_messages')
      .set({ status: 'sending', updated_at: now() })
      .where('id', 'in', (eb) => eb.selectFrom('scheduled_messages').select('id')
        .where('status', '=', 'pending')
        .where('scheduled_at', '<=', now())
        .orderBy('scheduled_at')
        .limit(limit)
        .forUpdate()
        .skipLocked())
      .returningAll()
      .execute();
    return (rows as ScheduledRow[]).map((r) => this._descifrar(r));
  }

  async marcarEnviado(id: string, messageId: string): Promise<void> {
    await this.db.updateTable('scheduled_messages')
      .set({ status: 'sent', sent_message_id: messageId, error: null, updated_at: now() })
      .where('id', '=', id)
      .execute();
  }

  async marcarFallido(id: string, motivo: string): Promise<void> {
    await this.db.updateTable('scheduled_messages')
      .set({ status: 'failed', error: motivo.slice(0, 500), updated_at: now() })
      .where('id', '=', id)
      .execute();
  }

  /** Cancelar sólo tiene sentido mientras no haya salido; devuelve la fila si canceló. */
  async cancelar(id: string, userId: string): Promise<ScheduledRow | undefined> {
    const row = await this.db.updateTable('scheduled_messages')
      .set({ status: 'cancelled', updated_at: now() })
      .where('id', '=', id)
      .where('sender_id', '=', userId)
      .where('status', '=', 'pending')
      .returningAll()
      .executeTakeFirst();
    return this._descifrar(row as ScheduledRow | undefined);
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
    const row = await this.db.insertInto('message_reminders')
      .values({ user_id, message_id, conversation_id, remind_at, note: note || null })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as ReminderRow;
  }

  async findByUser(userId: string, limit = 50): Promise<ReminderRow[]> {
    const rows = await this.db.selectFrom('message_reminders as r')
      .innerJoin('messages as m', 'm.id', 'r.message_id')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .selectAll('r')
      .select(['m.body as message_body', 'u.display_name as message_sender_display_name'])
      .where('r.user_id', '=', userId)
      .orderBy((eb) => eb.case().when('r.status', '=', 'pending').then(1).else(0).end(), 'desc')
      .orderBy('r.remind_at', 'asc')
      .limit(limit)
      .execute() as unknown as ReminderRow[];
    // El body del mensaje referenciado también viene cifrado.
    for (const row of rows) row.message_body = decrypt(row.message_body);
    return rows;
  }

  async tomarVencidos(limit = 100): Promise<ReminderRow[]> {
    return this.db.updateTable('message_reminders')
      .set({ status: 'done' })
      .where('id', 'in', (eb) => eb.selectFrom('message_reminders').select('id')
        .where('status', '=', 'pending')
        .where('remind_at', '<=', now())
        .orderBy('remind_at')
        .limit(limit)
        .forUpdate()
        .skipLocked())
      .returningAll()
      .execute() as Promise<ReminderRow[]>;
  }

  async cancelar(id: string, userId: string): Promise<ReminderRow | undefined> {
    const row = await this.db.updateTable('message_reminders')
      .set({ status: 'cancelled' })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('status', '=', 'pending')
      .returningAll()
      .executeTakeFirst();
    return row as ReminderRow | undefined;
  }
}

export const scheduledMessageRepository = new ScheduledMessageRepository();
export const reminderRepository = new ReminderRepository();
