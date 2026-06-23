const BaseRepository = require('./base.repository');

class SystemSettingsRepository extends BaseRepository {
  constructor() {
    super('system_settings');
  }

  async findAll() {
    const { rows } = await this.query(
      `SELECT * FROM system_settings ORDER BY category, key`
    );
    return rows;
  }

  async findByKey(key) {
    const { rows } = await this.query(
      `SELECT * FROM system_settings WHERE key = $1`,
      [key]
    );
    return rows[0] || null;
  }

  async update(key, value, updatedBy) {
    const { rows } = await this.query(
      `UPDATE system_settings
       SET value = $2::jsonb, updated_by = $3, updated_at = NOW()
       WHERE key = $1 RETURNING *`,
      [key, JSON.stringify(value), updatedBy]
    );
    return rows[0];
  }
}

module.exports = new SystemSettingsRepository();
