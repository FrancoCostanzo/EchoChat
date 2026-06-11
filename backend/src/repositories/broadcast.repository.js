const BaseRepository = require('./base.repository');

class BroadcastRepository extends BaseRepository {
  constructor() {
    super('broadcast_lists');
  }

  async createList({ name, description, owner_id }) {
    const { rows } = await this.query(
      `INSERT INTO broadcast_lists (name, description, owner_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, owner_id]
    );
    return rows[0];
  }

  async addRecipients(broadcastListId, userIds, addedBy) {
    if (!userIds?.length) return;
    for (const uid of userIds) {
      await this.query(
        `INSERT INTO broadcast_recipients (broadcast_list_id, user_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (broadcast_list_id, user_id) DO NOTHING`,
        [broadcastListId, uid, addedBy]
      );
    }
  }

  async removeRecipient(broadcastListId, userId) {
    await this.query(
      `DELETE FROM broadcast_recipients WHERE broadcast_list_id = $1 AND user_id = $2`,
      [broadcastListId, userId]
    );
  }

  async getRecipients(broadcastListId) {
    const { rows } = await this.query(
      `SELECT br.*, u.username, u.display_name
       FROM broadcast_recipients br
       JOIN users u ON u.id = br.user_id
       WHERE br.broadcast_list_id = $1`,
      [broadcastListId]
    );
    return rows;
  }

  async findByOwner(ownerId) {
    const { rows } = await this.query(
      `SELECT * FROM broadcast_lists WHERE owner_id = $1 AND is_active = TRUE ORDER BY updated_at DESC`,
      [ownerId]
    );
    return rows;
  }

  async createMessage({ broadcast_list_id, sender_id, body, type, object_id, scheduled_at }) {
    const isFuture = scheduled_at && new Date(scheduled_at) > new Date();
    const { rows } = await this.query(
      `INSERT INTO broadcast_messages (broadcast_list_id, sender_id, body, type, object_id, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [broadcast_list_id, sender_id, body, type || 'text', object_id || null,
       scheduled_at || null, isFuture ? 'scheduled' : 'draft']
    );
    return rows[0];
  }

  async findMessageById(id) {
    const { rows } = await this.query(`SELECT * FROM broadcast_messages WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async findMessagesByListId(listId) {
    const { rows } = await this.query(
      `SELECT * FROM broadcast_messages WHERE broadcast_list_id = $1 ORDER BY created_at DESC`,
      [listId]
    );
    return rows;
  }

  async findDueScheduledMessages(limit = 50) {
    const { rows } = await this.query(
      `SELECT * FROM broadcast_messages
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async updateMessageStatus(id, { status, sent_at, total_recipients, total_delivered, total_read }) {
    const { rows } = await this.query(
      `UPDATE broadcast_messages
       SET status = COALESCE($2, status),
           sent_at = COALESCE($3, sent_at),
           total_recipients = COALESCE($4, total_recipients),
           total_delivered = COALESCE($5, total_delivered),
           total_read = COALESCE($6, total_read)
       WHERE id = $1 RETURNING *`,
      [id, status || null, sent_at || null, total_recipients ?? null, total_delivered ?? null, total_read ?? null]
    );
    return rows[0];
  }

  async createDelivery({ broadcast_msg_id, user_id, conversation_id }) {
    const { rows } = await this.query(
      `INSERT INTO broadcast_deliveries (broadcast_msg_id, user_id, conversation_id, delivered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (broadcast_msg_id, user_id) DO UPDATE
       SET conversation_id = EXCLUDED.conversation_id, delivered_at = NOW()
       RETURNING *`,
      [broadcast_msg_id, user_id, conversation_id]
    );
    return rows[0];
  }

  async findUserIdsByDepartment(department) {
    const { rows } = await this.query(
      `SELECT id FROM users WHERE department = $1 AND status = 'active'`,
      [department]
    );
    return rows.map((r) => r.id);
  }
}

module.exports = new BroadcastRepository();
