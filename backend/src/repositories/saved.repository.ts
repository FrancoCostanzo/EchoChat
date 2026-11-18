import BaseRepository from './base.repository';
import { encrypt, decrypt } from '../utils/crypto.util';
import { now } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { SavedMessageRow } from '../models/message.model';

type SavedRow = Row<'saved_messages'>;

// User-scoped saved/bookmarked messages (table: saved_messages).
class SavedMessageRepository extends BaseRepository<SavedRow> {
  constructor() {
    super('saved_messages');
  }

  async save(userId: string, messageId: string, note?: string | null): Promise<SavedRow> {
    const encrypted = encrypt(note || null);
    const row = await this.db.insertInto('saved_messages')
      .values({ user_id: userId, message_id: messageId, note: encrypted })
      .onConflict((oc) => oc.columns(['user_id', 'message_id']).doUpdateSet({ note: encrypted, saved_at: now() }))
      .returningAll()
      .executeTakeFirst() as SavedRow | undefined;
    if (row) row.note = decrypt(row.note);
    return row as SavedRow;
  }

  async unsave(userId: string, messageId: string): Promise<boolean> {
    const result = await this.db.deleteFrom('saved_messages')
      .where('user_id', '=', userId)
      .where('message_id', '=', messageId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async list(
    userId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<SavedMessageRow[]> {
    const rows = await this.db.selectFrom('saved_messages as sm')
      .innerJoin('messages as m', 'm.id', 'sm.message_id')
      .leftJoin('users as u', 'u.id', 'm.sender_id')
      .leftJoin('conversations as c', 'c.id', 'm.conversation_id')
      .selectAll('m')
      .select([
        'sm.note as saved_note',
        'sm.saved_at',
        'u.username as sender_username',
        'u.display_name as sender_display_name',
        'u.avatar_object_key as sender_avatar_key',
        'c.name as conversation_name',
        'c.type as conversation_type',
      ])
      .where('sm.user_id', '=', userId)
      .orderBy('sm.saved_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute() as unknown as SavedMessageRow[];
    // Tanto el cuerpo del mensaje (m.body) como la nota personal van cifrados.
    for (const row of rows) {
      row.body = decrypt(row.body);
      row.saved_note = decrypt(row.saved_note);
    }
    return rows;
  }
}

export default new SavedMessageRepository();
