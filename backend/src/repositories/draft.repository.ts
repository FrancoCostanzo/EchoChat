import { sql } from 'kysely';
import BaseRepository from './base.repository';
import { encrypt, decrypt } from '../utils/crypto.util';
import type { DraftRequest } from '../dtos/message.dto';
// El tipo lo declara el modelo, que ya reemplaza el Json crudo de
// pending_attachments por el array que el código realmente guarda.
import type { DraftRow } from '../models/message.model';

// Per-user, per-conversation message drafts (table: drafts).
// Primer repositorio pasado a Kysely (docs/MULTI_DB.md, etapa 0).
class DraftRepository extends BaseRepository<DraftRow> {
  constructor() {
    super('drafts');
  }

  async upsert(
    userId: string,
    conversationId: string,
    { body, reply_to_id, pending_attachments }: DraftRequest,
  ): Promise<DraftRow> {
    const values = {
      body: encrypt(body || null),
      reply_to_id: reply_to_id || null,
      pending_attachments: JSON.stringify(pending_attachments || []),
      // TODO(etapa 3): helper now() por dialecto.
      updated_at: sql<Date>`now()`,
    };
    const row = await this.db
      .insertInto('drafts')
      .values({ user_id: userId, conversation_id: conversationId, ...values })
      .onConflict((oc) => oc.columns(['user_id', 'conversation_id']).doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this._decrypt(row as DraftRow)!;
  }

  /** El cuerpo se guarda cifrado; se descifra al leer (ver utils/crypto.util). */
  _decrypt(row: DraftRow | undefined): DraftRow | undefined {
    if (row) row.body = decrypt(row.body);
    return row;
  }

  async get(userId: string, conversationId: string): Promise<DraftRow | null> {
    const row = await this.db
      .selectFrom('drafts')
      .selectAll()
      .where('user_id', '=', userId)
      .where('conversation_id', '=', conversationId)
      .executeTakeFirst();
    return this._decrypt(row as DraftRow | undefined) || null;
  }

  async remove(userId: string, conversationId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('drafts')
      .where('user_id', '=', userId)
      .where('conversation_id', '=', conversationId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async listByUser(userId: string): Promise<DraftRow[]> {
    const rows = await this.db
      .selectFrom('drafts')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('updated_at', 'desc')
      .execute();
    return (rows as DraftRow[]).map((r) => this._decrypt(r)!);
  }
}

export default new DraftRepository();
