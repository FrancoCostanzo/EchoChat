const { pool } = require('../config/database');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }

  async findById(id) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async deleteById(id) {
    const { rowCount } = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  }

  async exists(id) {
    const { rows } = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows.length > 0;
  }
}

module.exports = BaseRepository;
