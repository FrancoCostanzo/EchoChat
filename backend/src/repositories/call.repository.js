const BaseRepository = require('./base.repository');

class CallRepository extends BaseRepository {
  constructor() {
    super('calls');
  }

  async create({ conversation_id, type, initiated_by }) {
    const { rows } = await this.query(
      `INSERT INTO calls (conversation_id, type, initiated_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversation_id || null, type, initiated_by]
    );
    return rows[0];
  }

  async updateStatus(id, status, endReason = null) {
    const extras = [];
    const params = [status, id];

    if (status === 'active') {
      extras.push('answered_at = NOW()');
    }
    if (status === 'ended' || status === 'missed' || status === 'rejected' || status === 'failed') {
      extras.push(`ended_at = NOW()`);
      extras.push(`end_reason = $${params.length + 1}`);
      params.push(endReason);
    }

    const setClauses = [`status = $1`, ...extras].join(', ');
    const { rows } = await this.query(
      `UPDATE calls SET ${setClauses} WHERE id = $2 RETURNING *`,
      params
    );
    return rows[0];
  }

  async addParticipant(callId, userId) {
    const { rows } = await this.query(
      `INSERT INTO call_participants (call_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (call_id, user_id) DO NOTHING
       RETURNING *`,
      [callId, userId]
    );
    return rows[0];
  }

  async updateParticipant(callId, userId, fields) {
    const allowed = ['status', 'can_speak', 'can_video', 'can_share_screen', 'is_muted_by_host'];
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

    // Update timestamp columns based on status
    if (fields.status === 'joined') sets.push('joined_at = NOW()');
    if (['left', 'rejected', 'no_answer', 'busy'].includes(fields.status)) sets.push('left_at = NOW()');

    if (sets.length === 0) return null;

    values.push(callId, userId);
    const { rows } = await this.query(
      `UPDATE call_participants SET ${sets.join(', ')}
       WHERE call_id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`,
      values
    );
    return rows[0];
  }

  async getParticipants(callId) {
    const { rows } = await this.query(
      `SELECT cp.*, u.username, u.display_name, u.avatar_object_key
       FROM call_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.call_id = $1
       ORDER BY cp.invited_at`,
      [callId]
    );
    return rows;
  }

  async findByConversation(conversationId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await this.query(
      `SELECT * FROM calls
       WHERE conversation_id = $1
       ORDER BY initiated_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return rows;
  }

  async findActiveByUser(userId) {
    const { rows } = await this.query(
      `SELECT c.* FROM calls c
       JOIN call_participants cp ON cp.call_id = c.id
       WHERE cp.user_id = $1 AND c.status IN ('pending','ringing','active')
       ORDER BY c.initiated_at DESC`,
      [userId]
    );
    return rows;
  }
}

module.exports = new CallRepository();
