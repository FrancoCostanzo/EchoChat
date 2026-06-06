const BaseRepository = require('./base.repository');

// Handles channel-specific tables: channel_settings (1:1 with a conversation of
// type 'channel') and channel_join_requests.
class ChannelRepository extends BaseRepository {
  constructor() {
    super('channel_settings');
  }

  async createSettings(conversationId, { category, is_official, post_restriction, join_mode }) {
    const { rows } = await this.query(
      `INSERT INTO channel_settings (conversation_id, category, is_official, post_restriction, join_mode)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        conversationId,
        category || null,
        is_official ?? false,
        post_restriction || 'members',
        join_mode || 'open',
      ]
    );
    return rows[0];
  }

  async getSettings(conversationId) {
    const { rows } = await this.query(
      `SELECT * FROM channel_settings WHERE conversation_id = $1`,
      [conversationId]
    );
    return rows[0] || null;
  }

  async updateSettings(conversationId, fields) {
    const allowed = ['category', 'is_official', 'post_restriction', 'join_mode'];
    const sets = [];
    const values = [];
    let idx = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return this.getSettings(conversationId);

    values.push(conversationId);
    const { rows } = await this.query(
      `UPDATE channel_settings SET ${sets.join(', ')} WHERE conversation_id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  // Discoverable channels, with the requesting user's membership/request state.
  async findDiscoverable(userId, { search, category, limit = 30, offset = 0 } = {}) {
    const conditions = [
      `c.type = 'channel'`,
      `c.is_discoverable = TRUE`,
      `c.is_archived = FALSE`,
    ];
    const values = [userId];
    let idx = 2;

    if (search) {
      conditions.push(`(c.name ILIKE $${idx} OR c.description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }
    if (category) {
      conditions.push(`cs.category = $${idx}`);
      values.push(category);
      idx++;
    }

    values.push(limit, offset);
    const { rows } = await this.query(
      `SELECT c.id, c.name, c.description, c.topic, c.avatar_object_id, c.max_members, c.created_at,
              cs.category, cs.is_official, cs.member_count, cs.post_restriction, cs.join_mode,
              EXISTS (
                SELECT 1 FROM conversation_members cm
                WHERE cm.conversation_id = c.id AND cm.user_id = $1 AND cm.left_at IS NULL
              ) AS is_member,
              EXISTS (
                SELECT 1 FROM channel_join_requests jr
                WHERE jr.conversation_id = c.id AND jr.user_id = $1 AND jr.status = 'pending'
              ) AS has_pending_request
       FROM conversations c
       JOIN channel_settings cs ON cs.conversation_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cs.is_official DESC, cs.member_count DESC, c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );
    return rows;
  }

  // ── Join requests ─────────────────────────────────────────────────────────
  async createJoinRequest(conversationId, userId, message) {
    const { rows } = await this.query(
      `INSERT INTO channel_join_requests (conversation_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, userId, message || null]
    );
    return rows[0];
  }

  async findPendingRequest(conversationId, userId) {
    const { rows } = await this.query(
      `SELECT * FROM channel_join_requests
       WHERE conversation_id = $1 AND user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [conversationId, userId]
    );
    return rows[0] || null;
  }

  async findRequestById(requestId) {
    const { rows } = await this.query(
      `SELECT * FROM channel_join_requests WHERE id = $1`,
      [requestId]
    );
    return rows[0] || null;
  }

  async listJoinRequests(conversationId, { status = 'pending', limit = 50, offset = 0 } = {}) {
    const { rows } = await this.query(
      `SELECT jr.*, u.username, u.display_name, u.avatar_object_key, u.department
       FROM channel_join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.conversation_id = $1 AND jr.status = $2
       ORDER BY jr.created_at ASC
       LIMIT $3 OFFSET $4`,
      [conversationId, status, limit, offset]
    );
    return rows;
  }

  async reviewJoinRequest(requestId, reviewerId, status) {
    const { rows } = await this.query(
      `UPDATE channel_join_requests
       SET status = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [requestId, status, reviewerId]
    );
    return rows[0] || null;
  }
}

module.exports = new ChannelRepository();
