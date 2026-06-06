const BaseRepository = require('./base.repository');

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
      [userId, conversationId, body || null, reply_to_id || null,
       JSON.stringify(pending_attachments || [])]
    );
    return rows[0];
  }

  async get(userId, conversationId) {
    const { rows } = await this.query(
      `SELECT * FROM drafts WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId]
    );
    return rows[0] || null;
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
    return rows;
  }
}

module.exports = new DraftRepository();
