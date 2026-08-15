import BaseRepository from './base.repository';
import { encrypt, decrypt } from '../utils/crypto.util';
import type { DraftRequest } from '../dtos/message.dto';
// El tipo lo declara el modelo, que ya reemplaza el Json crudo de
// pending_attachments por el array que el código realmente guarda.
import type { DraftRow } from '../models/message.model';

// Per-user, per-conversation message drafts (table: drafts).
class DraftRepository extends BaseRepository<DraftRow> {
  constructor() {
    super('drafts');
  }

  async upsert(
    userId: string,
    conversationId: string,
    { body, reply_to_id, pending_attachments }: DraftRequest,
  ): Promise<DraftRow> {
    const { rows } = await this.query(
      `INSERT INTO drafts (user_id, conversation_id, body, reply_to_id, pending_attachments, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, conversation_id) DO UPDATE
       SET body = $3, reply_to_id = $4, pending_attachments = $5, updated_at = NOW()
       RETURNING *`,
      [userId, conversationId, encrypt(body || null), reply_to_id || null,
       JSON.stringify(pending_attachments || [])]
    );
    return this._decrypt(rows[0])!;
  }

  /** El cuerpo se guarda cifrado; se descifra al leer (ver utils/crypto.util). */
  _decrypt(row: DraftRow | undefined): DraftRow | undefined {
    if (row) row.body = decrypt(row.body);
    return row;
  }

  async get(userId: string, conversationId: string): Promise<DraftRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM drafts WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return this._decrypt(rows[0]) || null;
  }

  async remove(userId: string, conversationId: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM drafts WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return (rowCount ?? 0) > 0;
  }

  async listByUser(userId: string): Promise<DraftRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM drafts WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    rows.forEach((r) => this._decrypt(r));
    return rows;
  }
}

export default new DraftRepository();
