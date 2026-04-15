const BaseRepository = require('./base.repository');

class SessionRepository extends BaseRepository {
  constructor() {
    super('user_sessions');
  }

  async create({ userId, tokenHash, deviceName, deviceType, ipAddress, userAgent, expiresAt }) {
    const { rows } = await this.query(
      `INSERT INTO user_sessions (user_id, token_hash, device_name, device_type, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, tokenHash, deviceName || null, deviceType || 'web', ipAddress || null, userAgent || null, expiresAt]
    );
    return rows[0];
  }

  async findActiveByTokenHash(tokenHash) {
    const { rows } = await this.query(
      `SELECT * FROM user_sessions
       WHERE token_hash = $1 AND is_active = TRUE AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async findActiveByUser(userId) {
    const { rows } = await this.query(
      `SELECT id, device_name, device_type, ip_address, last_activity, created_at
       FROM user_sessions
       WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );
    return rows;
  }

  async deactivate(id) {
    await this.query(
      'UPDATE user_sessions SET is_active = FALSE WHERE id = $1',
      [id]
    );
  }

  async deactivateAllForUser(userId) {
    await this.query(
      'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1',
      [userId]
    );
  }

  async updateActivity(id) {
    await this.query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE id = $1',
      [id]
    );
  }
}

module.exports = new SessionRepository();
