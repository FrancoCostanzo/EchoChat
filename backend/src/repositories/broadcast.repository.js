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
      `SELECT br.*, u.username, u.display_name, u.department,
              u.avatar_bucket, u.avatar_object_key, u.presence
       FROM broadcast_recipients br
       JOIN users u ON u.id = br.user_id
       WHERE br.broadcast_list_id = $1
       ORDER BY u.display_name`,
      [broadcastListId]
    );
    return rows;
  }

  async findByOwner(ownerId) {
    const { rows } = await this.query(
      `SELECT bl.*,
              (SELECT COUNT(*)::int FROM broadcast_recipients br
               WHERE br.broadcast_list_id = bl.id) AS recipient_count
       FROM broadcast_lists bl
       WHERE bl.owner_id = $1 AND bl.is_active = TRUE
       ORDER BY bl.updated_at DESC`,
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
    // Live client-receipt totals (not denormalized fan-out counters).
    const { rows } = await this.query(
      `SELECT bm.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_bucket AS sender_avatar_bucket,
              u.avatar_object_key AS sender_avatar_object_key,
              COALESCE((
                SELECT COUNT(*)::int FROM broadcast_deliveries bd
                WHERE bd.broadcast_msg_id = bm.id AND bd.conversation_id IS NOT NULL
              ), 0) AS total_sent,
              COALESCE((
                SELECT COUNT(*)::int
                FROM message_receipts mr
                JOIN messages m ON m.id = mr.message_id
                WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
                  AND mr.delivered_at IS NOT NULL
              ), 0) AS total_delivered,
              COALESCE((
                SELECT COUNT(*)::int
                FROM message_receipts mr
                JOIN messages m ON m.id = mr.message_id
                WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
                  AND mr.read_at IS NOT NULL
              ), 0) AS total_read
       FROM broadcast_messages bm
       JOIN users u ON u.id = bm.sender_id
       WHERE bm.broadcast_list_id = $1
       ORDER BY bm.created_at DESC`,
      [listId]
    );
    return rows;
  }

  async getDeliveries(broadcastMsgId) {
    // Join the fan-out row with the DM that was created and its real client
    // receipts (delivered/read). `bd.delivered_at` is the server fan-out time;
    // `mr.*` is what the recipient's client actually acknowledged.
    const { rows } = await this.query(
      `SELECT bd.broadcast_msg_id,
              bd.user_id,
              bd.conversation_id,
              bd.delivered_at AS sent_to_chat_at,
              bd.read_at AS legacy_read_at,
              u.username, u.display_name, u.department,
              u.avatar_bucket, u.avatar_object_key, u.presence,
              m.id AS message_id,
              mr.delivered_at AS received_at,
              mr.read_at AS read_at
       FROM broadcast_deliveries bd
       JOIN users u ON u.id = bd.user_id
       LEFT JOIN messages m
         ON m.conversation_id = bd.conversation_id
        AND m.deleted_at IS NULL
        AND (m.metadata->>'broadcast_msg_id') = bd.broadcast_msg_id::text
       LEFT JOIN message_receipts mr
         ON mr.message_id = m.id
        AND mr.user_id = bd.user_id
       WHERE bd.broadcast_msg_id = $1
       ORDER BY COALESCE(mr.read_at, mr.delivered_at, bd.delivered_at) DESC NULLS LAST,
                u.display_name`,
      [broadcastMsgId]
    );
    return rows;
  }

  async syncDeliveryReceipt(broadcastMsgId, userId, { received = false, read = false } = {}) {
    const { rows } = await this.query(
      `UPDATE broadcast_deliveries
       SET delivered_at = CASE
             WHEN $3 THEN COALESCE(delivered_at, NOW())
             ELSE delivered_at
           END,
           read_at = CASE
             WHEN $4 THEN NOW()
             ELSE read_at
           END
       WHERE broadcast_msg_id = $1 AND user_id = $2
       RETURNING *`,
      [broadcastMsgId, userId, received, read]
    );
    return rows[0] || null;
  }

  async refreshMessageTotals(broadcastMsgId) {
    const { rows } = await this.query(
      `UPDATE broadcast_messages bm
       SET total_delivered = (
             SELECT COUNT(*)::int
             FROM message_receipts mr
             JOIN messages m ON m.id = mr.message_id
             WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
               AND mr.delivered_at IS NOT NULL
           ),
           total_read = (
             SELECT COUNT(*)::int
             FROM message_receipts mr
             JOIN messages m ON m.id = mr.message_id
             WHERE (m.metadata->>'broadcast_msg_id') = bm.id::text
               AND mr.read_at IS NOT NULL
           )
       WHERE bm.id = $1
       RETURNING *`,
      [broadcastMsgId]
    );
    return rows[0] || null;
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
    // delivered_at here = "fan-out to DM succeeded" (server side). Client
    // receipt times live on message_receipts and are joined in getDeliveries.
    const { rows } = await this.query(
      `INSERT INTO broadcast_deliveries (broadcast_msg_id, user_id, conversation_id, delivered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (broadcast_msg_id, user_id) DO UPDATE
       SET conversation_id = EXCLUDED.conversation_id
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
