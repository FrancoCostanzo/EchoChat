const BaseRepository = require('./base.repository');

class MessageRepository extends BaseRepository {
  constructor() {
    super('messages');
  }

  async create({ conversation_id, sender_id, type, body, body_format, reply_to_id, thread_id, forwarded_from_id, forwarded_from_conv, metadata }) {
    const { rows } = await this.query(
      `INSERT INTO messages (conversation_id, sender_id, type, body, body_format, reply_to_id, thread_id, forwarded_from_id, forwarded_from_conv, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [conversation_id, sender_id, type || 'text', body || null, body_format || 'plain',
       reply_to_id || null, thread_id || null, forwarded_from_id || null, forwarded_from_conv || null, metadata || {}]
    );
    return rows[0];
  }

  async findByConversation(conversationId, { cursor, limit = 50, direction = 'before' } = {}) {
    // Thread replies live in their own side panel; the main timeline only
    // shows root messages (with a reply counter aggregated below).
    let condition = 'm.conversation_id = $1 AND m.thread_id IS NULL';
    const params = [conversationId];

    if (cursor) {
      const op = direction === 'before' ? '<' : '>';
      const cursorMsg = await this.findById(cursor);
      if (cursorMsg) {
        condition += ` AND m.sent_at ${op} $${params.length + 1}`;
        params.push(cursorMsg.sent_at);
      }
    }

    params.push(limit);
    const order = direction === 'before' ? 'DESC' : 'ASC';

    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              rm.body AS reply_to_body,
              rm.type AS reply_to_type,
              ru.display_name AS reply_to_sender,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', so.id,
                    'object_type', so.object_type,
                    'original_filename', so.original_filename,
                    'mime_type', so.mime_type,
                    'file_size_bytes', so.file_size_bytes,
                    'image_width', so.image_width,
                    'image_height', so.image_height,
                    'duration_ms', so.duration_ms
                  ) ORDER BY ma.sort_order
                ) FILTER (WHERE ma.id IS NOT NULL),
                '[]'
              ) AS attachments,
              -- Receipt aggregation: count of delivered and read per message
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.delivered_at IS NOT NULL) AS delivered_count,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count,
              (SELECT COUNT(*) FROM messages tm WHERE tm.thread_id = m.id AND tm.is_deleted = FALSE)::int AS thread_count,
              -- Reactions aggregation
              COALESCE(
                (SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt, 'user_ids', r.user_ids))
                 FROM (
                   SELECT emoji,
                          COUNT(*)::text AS cnt,
                          json_agg(user_id) AS user_ids
                   FROM message_reactions
                   WHERE message_id = m.id
                   GROUP BY emoji
                 ) r),
                '[]'
              ) AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE ${condition}
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key, rm.body, rm.type, ru.display_name
       ORDER BY m.sent_at ${order}
       LIMIT $${params.length}`,
      params
    );

    return direction === 'before' ? rows.reverse() : rows;
  }

  async findWithAttachments(messageId) {
    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              rm.body AS reply_to_body,
              rm.type AS reply_to_type,
              ru.display_name AS reply_to_sender,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', so.id,
                    'object_type', so.object_type,
                    'original_filename', so.original_filename,
                    'mime_type', so.mime_type,
                    'file_size_bytes', so.file_size_bytes,
                    'image_width', so.image_width,
                    'image_height', so.image_height,
                    'duration_ms', so.duration_ms
                  ) ORDER BY ma.sort_order
                ) FILTER (WHERE ma.id IS NOT NULL),
                '[]'
              ) AS attachments,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.delivered_at IS NOT NULL) AS delivered_count,
              (SELECT COUNT(*) FROM message_receipts mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count,
              (SELECT COUNT(*) FROM messages tm WHERE tm.thread_id = m.id AND tm.is_deleted = FALSE)::int AS thread_count,
              COALESCE(
                (SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt, 'user_ids', r.user_ids))
                 FROM (
                   SELECT emoji,
                          COUNT(*)::text AS cnt,
                          json_agg(user_id) AS user_ids
                   FROM message_reactions
                   WHERE message_id = m.id
                   GROUP BY emoji
                 ) r),
                '[]'
              ) AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE m.id = $1
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key, rm.body, rm.type, ru.display_name`,
      [messageId]
    );
    return rows[0] || null;
  }

  // All replies of a thread (oldest first), with the same enrichment as the
  // conversation timeline so the thread panel can reuse the message renderer.
  async findThreadReplies(threadId, { limit = 200 } = {}) {
    const { rows } = await this.query(
      `SELECT m.*,
              u.username AS sender_username,
              u.display_name AS sender_display_name,
              u.avatar_object_key AS sender_avatar_key,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', so.id,
                    'object_type', so.object_type,
                    'original_filename', so.original_filename,
                    'mime_type', so.mime_type,
                    'file_size_bytes', so.file_size_bytes,
                    'image_width', so.image_width,
                    'image_height', so.image_height,
                    'duration_ms', so.duration_ms
                  ) ORDER BY ma.sort_order
                ) FILTER (WHERE ma.id IS NOT NULL),
                '[]'
              ) AS attachments,
              COALESCE(
                (SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt, 'user_ids', r.user_ids))
                 FROM (
                   SELECT emoji,
                          COUNT(*)::text AS cnt,
                          json_agg(user_id) AS user_ids
                   FROM message_reactions
                   WHERE message_id = m.id
                   GROUP BY emoji
                 ) r),
                '[]'
              ) AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN storage_objects so ON so.id = ma.object_id
       WHERE m.thread_id = $1
       GROUP BY m.id, u.username, u.display_name, u.avatar_object_key
       ORDER BY m.sent_at ASC
       LIMIT $2`,
      [threadId, limit]
    );
    return rows;
  }

  async countThreadReplies(threadId) {
    const { rows } = await this.query(
      `SELECT COUNT(*)::int AS count FROM messages WHERE thread_id = $1 AND is_deleted = FALSE`,
      [threadId]
    );
    return rows[0]?.count ?? 0;
  }

  async updateBody(id, body, editedBy) {
    // Save edit history
    const original = await this.findById(id);
    if (original && original.body) {
      await this.query(
        `INSERT INTO message_edits (message_id, body_before, edited_by) VALUES ($1, $2, $3)`,
        [id, original.body, editedBy]
      );
    }

    const { rows } = await this.query(
      `UPDATE messages SET body = $1, is_edited = TRUE, edited_at = NOW() WHERE id = $2 RETURNING *`,
      [body, id]
    );
    return rows[0];
  }

  async softDelete(id, deletedBy) {
    const { rows } = await this.query(
      `UPDATE messages SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2,
              body = NULL, type = 'deleted_placeholder'
       WHERE id = $1 RETURNING *`,
      [id, deletedBy]
    );
    return rows[0];
  }

  // Returns only attachment objects that are NOT shared with another message
  // (e.g. forwarded copies reference the same object_id). Callers use this to
  // physically remove MinIO files without breaking the original message.
  async getAttachmentObjects(messageId) {
    const { rows } = await this.query(
      `SELECT so.bucket_name, so.object_key, so.thumbnail_bucket, so.thumbnail_key, ma.id AS attachment_id, so.id AS object_id
       FROM message_attachments ma
       JOIN storage_objects so ON so.id = ma.object_id
       WHERE ma.message_id = $1
         AND (SELECT COUNT(*) FROM message_attachments ma2 WHERE ma2.object_id = ma.object_id) = 1`,
      [messageId]
    );
    return rows;
  }

  // Object ids attached to a message (used to clone attachments when forwarding)
  async getAttachmentObjectIds(messageId) {
    const { rows } = await this.query(
      `SELECT object_id FROM message_attachments WHERE message_id = $1 ORDER BY sort_order`,
      [messageId]
    );
    return rows.map((r) => r.object_id);
  }

  async deleteAttachments(messageId) {
    await this.query(`DELETE FROM message_attachments WHERE message_id = $1`, [messageId]);
    await this.query(
      `DELETE FROM storage_objects WHERE id IN (
         SELECT object_id FROM message_attachments WHERE message_id = $1
       )`,
      [messageId]
    );
  }

  async addAttachment(messageId, objectId, sortOrder = 0, caption = null) {
    const { rows } = await this.query(
      `INSERT INTO message_attachments (message_id, object_id, sort_order, caption)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [messageId, objectId, sortOrder, caption]
    );
    return rows[0];
  }

  async toggleReaction(messageId, userId, emoji) {
    const { rows } = await this.query(
      `SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    const existing = rows[0];
    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji → remove it
        await this.query(
          `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
          [messageId, userId]
        );
        return 'removed';
      }
      // Different emoji → update to new one
      await this.query(
        `UPDATE message_reactions SET emoji = $3 WHERE message_id = $1 AND user_id = $2`,
        [messageId, userId, emoji]
      );
      return 'updated';
    }
    await this.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
      [messageId, userId, emoji]
    );
    return 'added';
  }

  async removeReaction(messageId, userId, emoji) {
    const { rowCount } = await this.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );
    return rowCount > 0;
  }

  async getReactions(messageId) {
    const { rows } = await this.query(
      `SELECT emoji, COUNT(*) AS count,
              ARRAY_AGG(user_id) AS user_ids
       FROM message_reactions
       WHERE message_id = $1
       GROUP BY emoji`,
      [messageId]
    );
    return rows;
  }

  async addReceipt(messageId, userId, type = 'delivered') {
    const col = type === 'read' ? 'read_at' : 'delivered_at';
    const { rows } = await this.query(
      `INSERT INTO message_receipts (message_id, user_id, ${col})
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE SET ${col} = NOW()
       RETURNING *`,
      [messageId, userId]
    );
    return rows[0];
  }

  async getReceiptCounts(messageId) {
    const { rows } = await this.query(
      `SELECT
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered_count,
         COUNT(*) FILTER (WHERE read_at IS NOT NULL) AS read_count
       FROM message_receipts
       WHERE message_id = $1`,
      [messageId]
    );
    return rows[0] || { delivered_count: 0, read_count: 0 };
  }

  async getReceiptCountsBatch(messageIds) {
    if (!messageIds.length) return {};
    const { rows } = await this.query(
      `SELECT message_id,
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered_count,
         COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int AS read_count
       FROM message_receipts
       WHERE message_id = ANY($1)
       GROUP BY message_id`,
      [messageIds]
    );
    const map = {};
    for (const r of rows) {
      map[r.message_id] = { delivered_count: r.delivered_count, read_count: r.read_count };
    }
    return map;
  }

  async search(conversationId, term, limit = 20) {
    const { rows } = await this.query(
      `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND m.is_deleted = FALSE
         AND m.search_vector @@ plainto_tsquery('spanish', $2)
       ORDER BY ts_rank(m.search_vector, plainto_tsquery('spanish', $2)) DESC
       LIMIT $3`,
      [conversationId, term, limit]
    );
    return rows;
  }

  async pinMessage(conversationId, messageId, pinnedBy) {
    const { rows } = await this.query(
      `INSERT INTO pinned_messages (conversation_id, message_id, pinned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, message_id) DO NOTHING
       RETURNING *`,
      [conversationId, messageId, pinnedBy]
    );
    return rows[0];
  }

  async unpinMessage(conversationId, messageId) {
    const { rowCount } = await this.query(
      `DELETE FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2`,
      [conversationId, messageId]
    );
    return rowCount > 0;
  }

  async getPinnedMessages(conversationId) {
    const { rows } = await this.query(
      `SELECT m.*, pm.pinned_by, pm.pinned_at,
              u.username AS sender_username, u.display_name AS sender_display_name
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE pm.conversation_id = $1
       ORDER BY pm.pinned_at DESC`,
      [conversationId]
    );
    return rows;
  }
}

module.exports = new MessageRepository();
