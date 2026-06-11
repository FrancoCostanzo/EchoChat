const BaseRepository = require('./base.repository');

class WallpaperRepository extends BaseRepository {
  constructor() {
    super('user_wallpapers');
  }

  async findAllForUser(userId) {
    const { rows } = await this.query(
      `SELECT * FROM user_wallpapers
       WHERE user_id = $1
       ORDER BY scope, scope_key`,
      [userId]
    );
    return rows;
  }

  async findOne(userId, scope, scope_key) {
    const { rows } = await this.query(
      `SELECT * FROM user_wallpapers
       WHERE user_id = $1 AND scope = $2 AND scope_key = $3`,
      [userId, scope, scope_key]
    );
    return rows[0] || null;
  }

  async upsert(userId, { scope, scope_key, wallpaper_type, wallpaper_value, storage_object_id }) {
    const { rows } = await this.query(
      `INSERT INTO user_wallpapers
         (user_id, scope, scope_key, wallpaper_type, wallpaper_value, storage_object_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, scope, scope_key) DO UPDATE
         SET wallpaper_type    = EXCLUDED.wallpaper_type,
             wallpaper_value   = EXCLUDED.wallpaper_value,
             storage_object_id = EXCLUDED.storage_object_id,
             updated_at        = NOW()
       RETURNING *`,
      [userId, scope, scope_key, wallpaper_type, wallpaper_value ?? null, storage_object_id ?? null]
    );
    return rows[0];
  }

  async deleteOne(userId, scope, scope_key) {
    const { rowCount } = await this.query(
      `DELETE FROM user_wallpapers
       WHERE user_id = $1 AND scope = $2 AND scope_key = $3`,
      [userId, scope, scope_key]
    );
    return rowCount > 0;
  }
}

module.exports = new WallpaperRepository();
