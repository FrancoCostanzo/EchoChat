import BaseRepository from './base.repository';
import { upsert, insertIgnore } from '../config/db/upsert';
import { now } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { UpsertWallpaperRequest } from '../dtos/wallpaper.dto';

type WallpaperRow = Row<'user_wallpapers'>;

class WallpaperRepository extends BaseRepository<WallpaperRow> {
  constructor() {
    super('user_wallpapers');
  }

  async findAllForUser(userId: string): Promise<WallpaperRow[]> {
    return this.db.selectFrom('user_wallpapers').selectAll()
      .where('user_id', '=', userId)
      .orderBy('scope').orderBy('scope_key')
      .execute() as Promise<WallpaperRow[]>;
  }

  async findOne(userId: string, scope: string, scope_key: string): Promise<WallpaperRow | null> {
    const row = await this.db.selectFrom('user_wallpapers').selectAll()
      .where('user_id', '=', userId)
      .where('scope', '=', scope)
      .where('scope_key', '=', scope_key)
      .executeTakeFirst();
    return (row as WallpaperRow | undefined) ?? null;
  }

  async upsert(
    userId: string,
    { scope, scope_key, wallpaper_type, wallpaper_value, storage_object_id }: UpsertWallpaperRequest,
  ): Promise<WallpaperRow> {
    const values = {
      wallpaper_type,
      wallpaper_value: wallpaper_value ?? null,
      storage_object_id: storage_object_id ?? null,
      updated_at: now(),
    };
    const row = await upsert(this.db, { table: 'user_wallpapers', values: { user_id: userId, scope, scope_key, ...values }, conflict: ['user_id', 'scope', 'scope_key'], update: values, returning: true });
    return row as WallpaperRow;
  }

  async deleteOne(userId: string, scope: string, scope_key: string): Promise<boolean> {
    const result = await this.db.deleteFrom('user_wallpapers')
      .where('user_id', '=', userId)
      .where('scope', '=', scope)
      .where('scope_key', '=', scope_key)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

export default new WallpaperRepository();
