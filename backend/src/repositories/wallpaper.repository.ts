import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { UpsertWallpaperRequest } from '../dtos/wallpaper.dto';

type WallpaperRow = Row<'user_wallpapers'>;

class WallpaperRepository extends BaseRepository<WallpaperRow> {
  constructor() {
    super('user_wallpapers');
  }

  async findAllForUser(userId: string): Promise<WallpaperRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM user_wallpapers
       WHERE user_id = $1
       ORDER BY scope, scope_key`,
      [userId]
    );
    return rows;
  }

  async findOne(userId: string, scope: string, scope_key: string): Promise<WallpaperRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM user_wallpapers
       WHERE user_id = $1 AND scope = $2 AND scope_key = $3`,
      [userId, scope, scope_key]
    );
    return rows[0] || null;
  }

  async upsert(
    userId: string,
    { scope, scope_key, wallpaper_type, wallpaper_value, storage_object_id }: UpsertWallpaperRequest,
  ): Promise<WallpaperRow> {
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

  async deleteOne(userId: string, scope: string, scope_key: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM user_wallpapers
       WHERE user_id = $1 AND scope = $2 AND scope_key = $3`,
      [userId, scope, scope_key]
    );
    return (rowCount ?? 0) > 0;
  }
}

export = new WallpaperRepository();
