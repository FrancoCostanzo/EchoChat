const BaseRepository = require('./base.repository');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByUsername(username) {
    const { rows } = await this.query(
      'SELECT * FROM users WHERE username = $1 AND status != $2',
      [username, 'deleted']
    );
    return rows[0] || null;
  }

  async findByEmail(email) {
    const { rows } = await this.query(
      'SELECT * FROM users WHERE email = $1 AND status != $2',
      [email, 'deleted']
    );
    return rows[0] || null;
  }

  async create({ username, display_name, email, phone_extension, department, job_title }) {
    const { rows } = await this.query(
      `INSERT INTO users (username, display_name, email, phone_extension, department, job_title)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [username, display_name, email || null, phone_extension || null, department || null, job_title || null]
    );
    return rows[0];
  }

  async updateProfile(id, fields) {
    const allowed = ['display_name', 'email', 'phone_extension', 'department', 'job_title',
      'presence', 'presence_message', 'timezone', 'locale'];
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
    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await this.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  }

  async updateAvatar(id, bucket, objectKey) {
    const { rows } = await this.query(
      `UPDATE users SET avatar_bucket = $1, avatar_object_key = $2 WHERE id = $3 RETURNING *`,
      [bucket, objectKey, id]
    );
    return rows[0];
  }

  async updatePresence(id, presence) {
    const { rows } = await this.query(
      `UPDATE users SET presence = $1, last_seen_at = NOW() WHERE id = $2 RETURNING *`,
      [presence, id]
    );
    return rows[0];
  }

  async softDelete(id) {
    const { rows } = await this.query(
      `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  // ── RBAC ────────────────────────────────────────────────────────────────
  // Distinct permission codes granted to a user through their (non-expired) roles.
  async getPermissionCodes(userId) {
    const { rows } = await this.query(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );
    return rows.map((r) => r.code);
  }

  // Role names held by a user (highest priority first), excluding expired grants.
  async getRoleNames(userId) {
    const { rows } = await this.query(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ORDER BY r.priority DESC`,
      [userId]
    );
    return rows.map((r) => r.name);
  }

  // Flip users who have been inactive for `minutes` from 'online' to 'away'.
  // Returns the affected user ids so the caller can broadcast presence changes.
  async markStaleOnlineAsAway(minutes) {
    const { rows } = await this.query(
      `UPDATE users
       SET presence = 'away'
       WHERE presence = 'online'
         AND last_seen_at IS NOT NULL
         AND last_seen_at < NOW() - ($1 * INTERVAL '1 minute')
       RETURNING id`,
      [minutes]
    );
    return rows.map((r) => r.id);
  }

  async hasPermission(userId, code) {
    const { rows } = await this.query(
      `SELECT 1
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
         AND p.code = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       LIMIT 1`,
      [userId, code]
    );
    return rows.length > 0;
  }

  async search(term, limit = 20, offset = 0) {
    const { rows } = await this.query(
      `SELECT * FROM users
       WHERE status != 'deleted'
         AND (display_name ILIKE $1 OR username ILIKE $1)
       ORDER BY display_name
       LIMIT $2 OFFSET $3`,
      [`%${term}%`, limit, offset]
    );
    return rows;
  }

  async listUsers({ search, status, department, limit = 50, offset = 0 } = {}) {
    const conditions = [`status != 'deleted'`];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(display_name ILIKE $${idx} OR username ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (department) {
      conditions.push(`department ILIKE $${idx}`);
      params.push(`%${department}%`);
      idx++;
    }

    params.push(limit, offset);
    const { rows } = await this.query(
      `SELECT * FROM users WHERE ${conditions.join(' AND ')}
       ORDER BY display_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  }

  async updateStatus(id, status) {
    const { rows } = await this.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND status != 'deleted' RETURNING *`,
      [status, id]
    );
    return rows[0];
  }

  async listRoles() {
    const { rows } = await this.query(
      `SELECT id, name, display_name, description, priority FROM roles ORDER BY priority DESC`
    );
    return rows;
  }

  async getUserRoles(userId) {
    const { rows } = await this.query(
      `SELECT r.id, r.name, r.display_name, ur.granted_at, ur.expires_at
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ORDER BY r.priority DESC`,
      [userId]
    );
    return rows;
  }

  async setUserRoles(userId, roleNames, grantedBy) {
    await this.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    if (!roleNames?.length) return [];
    const { rows } = await this.query(
      `INSERT INTO user_roles (user_id, role_id, granted_by)
       SELECT $1, r.id, $2 FROM roles r WHERE r.name = ANY($3::text[])
       RETURNING role_id`,
      [userId, grantedBy, roleNames]
    );
    return rows;
  }

  async countUsersWithRole(roleName) {
    const { rows } = await this.query(
      `SELECT COUNT(*)::int AS count
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [roleName]
    );
    return rows[0]?.count || 0;
  }
}

module.exports = new UserRepository();
