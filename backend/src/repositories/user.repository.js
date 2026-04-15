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
}

module.exports = new UserRepository();
