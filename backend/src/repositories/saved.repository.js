const BaseRepository = require('./base.repository');

// User-scoped saved/bookmarked messages (table: saved_messages).
class SavedMessageRepository extends BaseRepository {
  constructor() {
    super('saved_messages');
  }

  async save(userId, messageId, note) {
    const { rows } = await this.query(
      `INSERT INTO saved_messages (user_id, message_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, message_id) DO UPDATE SET note = $3, saved_at = NOW()
       RETURNING *`,
      [userId, messageId, note || null]
    );
    return rows[0];
  }

  async unsave(userId, messageId) {
    const { rowCount } = await this.query(
      `DELETE FROM saved_messages WHERE user_id = $1 AND message_id = $2`,
      [userId, messageId]
    );
    return rowCount > 0;
  }

  async list(userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await this.query(
      `SELECT m.*,
              sm.note AS saved_note,
              sm.saved_at,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              c.name AS conversation_name,
              c.type AS conversation_type
       FROM saved_messages sm
       JOIN messages m ON m.id = sm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN conversations c ON c.id = m.conversation_id
       WHERE sm.user_id = $1
       ORDER BY sm.saved_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }
}

module.exports = new SavedMessageRepository();
