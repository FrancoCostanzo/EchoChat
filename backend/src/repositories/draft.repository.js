const BaseRepository = require('./base.repository');
const { encrypt, decrypt } = require('../utils/crypto.util');

// Per-user, per-conversation message drafts (table: drafts).
class DraftRepository extends BaseRepository {
  constructor() {
    super('drafts');
  }

  async upsert(userId, conversationId, { body, reply_to_id, pending_attachments }) {
    const { rows } = await this.query(
      `INSERT INTO drafts (user_id, conversation_id, body, reply_to_id, pending_attachments, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, conversation_id) DO UPDATE
       SET body = $3, reply_to_id = $4, pending_attachments = $5, updated_at = NOW()
       RETURNING *`,
      [userId, conversationId, encrypt(body || null), reply_to_id || null,
       JSON.stringify(pending_attachments || [])]
    );
    return this._decrypt(rows[0]);
  }

  _decrypt(row) {
    if (row) row.body = decrypt(row.body);
    return row;
  }

  async get(userId, conversationId) {
    const { rows } = await this.query(
      `SELECT * FROM drafts WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return this._decrypt(rows[0]) || null;
  }

  async remove(userId, conversationId) {
    const { rowCount } = await this.query(
      `DELETE FROM drafts WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return rowCount > 0;
  }

  async listByUser(userId) {
    const { rows } = await this.query(
      `SELECT * FROM drafts WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    rows.forEach((r) => this._decrypt(r));
    return rows;
  }
}

module.exports = new DraftRepository();
