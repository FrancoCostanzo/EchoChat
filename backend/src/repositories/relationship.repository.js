const BaseRepository = require('./base.repository');

class RelationshipRepository extends BaseRepository {
  constructor() {
    super('user_relationships');
  }

  async create({ user_id, target_user_id, type, alias }) {
    const { rows } = await this.query(
      `INSERT INTO user_relationships (user_id, target_user_id, type, alias)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, target_user_id, type) DO UPDATE SET alias = $4
       RETURNING *`,
      [user_id, target_user_id, type, alias || null]
    );
    return rows[0];
  }

  async remove(userId, targetUserId, type) {
    const { rowCount } = await this.query(
      `DELETE FROM user_relationships WHERE user_id = $1 AND target_user_id = $2 AND type = $3`,
      [userId, targetUserId, type]
    );
    return rowCount > 0;
  }

  async findByUser(userId, type = null) {
    let sql = `SELECT ur.*, u.username, u.display_name, u.department,
                      u.avatar_bucket, u.avatar_object_key, u.presence
               FROM user_relationships ur
               JOIN users u ON u.id = ur.target_user_id
               WHERE ur.user_id = $1`;
    const params = [userId];
    if (type) {
      sql += ` AND ur.type = $2`;
      params.push(type);
    }
    sql += ' ORDER BY u.display_name';
    const { rows } = await this.query(sql, params);
    return rows;
  }

  async isBlocked(userId, targetUserId) {
    const { rows } = await this.query(
      `SELECT 1 FROM user_relationships
       WHERE user_id = $1 AND target_user_id = $2 AND type = 'blocked'`,
      [userId, targetUserId]
    );
    return rows.length > 0;
  }
}

module.exports = new RelationshipRepository();
