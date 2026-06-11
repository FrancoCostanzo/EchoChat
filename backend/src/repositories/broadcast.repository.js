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
    const { rows } = await this.query(
      `INSERT INTO broadcast_messages (broadcast_list_id, sender_id, body, type, object_id, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [broadcast_list_id, sender_id, body, type || 'text', object_id || null,
       scheduled_at || null, scheduled_at ? 'scheduled' : 'draft']
    );
    return rows[0];
  }
}

module.exports = new BroadcastRepository();
