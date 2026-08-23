import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { UserStickerRow } from '../models/sticker.model';
import type { UpdateStickerRequest, UpdatePackRequest } from '../dtos/sticker.dto';

type StickerRow = Row<'user_stickers'>;
type PackRow = Row<'sticker_packs'>;

/** Proyección de un pack, sin owner_id. */
export type PackSummary = Pick<PackRow, 'id' | 'name' | 'position' | 'created_at'>;

// Personal sticker collection. Decoupled from storage_objects so the same
// artwork (deduplicated by hash in MinIO) can live in several users'
// collections. `user_stickers` is the membership/metadata row; the artwork
// stays in storage_objects.
class StickerRepository extends BaseRepository<StickerRow> {
  constructor() {
    super('user_stickers');
  }

  // Columns joined from storage_objects, needed to size/preview a sticker.
  static COLLECTION_SELECT = `
    us.id, us.storage_object_id, us.pack_id, us.name, us.keywords,
    us.is_favorite, us.position, us.added_at,
    so.mime_type, so.image_width, so.image_height`;

  // Full collection, optionally filtered by a free-text query over name + keywords.
  async listCollection(
    ownerId: string,
    { search = null }: { search?: string | null } = {},
  ): Promise<UserStickerRow[]> {
    const { rows } = await this.query<UserStickerRow>(
      `SELECT ${StickerRepository.COLLECTION_SELECT}
       FROM user_stickers us
       JOIN storage_objects so ON so.id = us.storage_object_id
       WHERE us.owner_id = $1
         AND ($2::text IS NULL
              OR us.name ILIKE '%' || $2 || '%'
              OR EXISTS (SELECT 1 FROM unnest(us.keywords) k WHERE k ILIKE '%' || $2 || '%'))
       ORDER BY us.is_favorite DESC, us.position ASC, us.added_at DESC`,
      [ownerId, search && search.trim() ? search.trim() : null]
    );
    return rows;
  }

  // Recently used stickers still present in the user's collection.
  async listRecent(ownerId: string, limit = 16): Promise<UserStickerRow[]> {
    const { rows } = await this.query<UserStickerRow>(
      `SELECT ${StickerRepository.COLLECTION_SELECT}
       FROM sticker_usage u
       JOIN user_stickers us
         ON us.owner_id = u.owner_id AND us.storage_object_id = u.storage_object_id
       JOIN storage_objects so ON so.id = us.storage_object_id
       WHERE u.owner_id = $1
       ORDER BY u.last_used_at DESC
       LIMIT $2`,
      [ownerId, limit]
    );
    return rows;
  }

  async findEntry(id: string, ownerId: string): Promise<StickerRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM user_stickers WHERE id = $1 AND owner_id = $2`,
      [id, ownerId]
    );
    return rows[0] || null;
  }

  async findByOwnerAndObject(ownerId: string, storageObjectId: string): Promise<StickerRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM user_stickers WHERE owner_id = $1 AND storage_object_id = $2`,
      [ownerId, storageObjectId]
    );
    return rows[0] || null;
  }

  // Idempotent: re-adding an object already in the collection returns the
  // existing row instead of erroring (UNIQUE owner_id, storage_object_id).
  async addEntry(
    { ownerId, storageObjectId, packId = null, name = null, keywords = [] }: {
      ownerId: string;
      storageObjectId: string;
      packId?: string | null;
      name?: string | null;
      keywords?: string[];
    },
  ): Promise<StickerRow> {
    const { rows } = await this.query(
      `INSERT INTO user_stickers (owner_id, storage_object_id, pack_id, name, keywords)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (owner_id, storage_object_id)
       DO UPDATE SET added_at = user_stickers.added_at
       RETURNING *`,
      [ownerId, storageObjectId, packId, name, keywords]
    );
    return rows[0];
  }

  // Partial update — only the provided fields are written.
  async updateEntry(
    id: string,
    ownerId: string,
    fields: UpdateStickerRequest & { position?: number },
  ): Promise<StickerRow | null> {
    const allowed = ['name', 'keywords', 'pack_id', 'is_favorite', 'position'] as const;
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        params.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return this.findEntry(id, ownerId);
    params.push(id, ownerId);
    const { rows } = await this.query(
      `UPDATE user_stickers SET ${sets.join(', ')}
       WHERE id = $${idx} AND owner_id = $${idx + 1}
       RETURNING *`,
      params
    );
    return rows[0] || null;
  }

  async deleteEntry(id: string, ownerId: string): Promise<string | null> {
    const { rows } = await this.query<{ storage_object_id: string }>(
      `DELETE FROM user_stickers WHERE id = $1 AND owner_id = $2
       RETURNING storage_object_id`,
      [id, ownerId]
    );
    return rows[0]?.storage_object_id || null;
  }

  async recordUsage(ownerId: string, storageObjectId: string): Promise<void> {
    await this.query(
      `INSERT INTO sticker_usage (owner_id, storage_object_id, use_count, last_used_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (owner_id, storage_object_id)
       DO UPDATE SET use_count = sticker_usage.use_count + 1, last_used_at = NOW()`,
      [ownerId, storageObjectId]
    );
  }

  // ── Packs ──────────────────────────────────────────────────────────────
  async listPacks(ownerId: string): Promise<PackSummary[]> {
    const { rows } = await this.query<PackSummary>(
      `SELECT id, name, position, created_at
       FROM sticker_packs
       WHERE owner_id = $1
       ORDER BY position ASC, created_at ASC`,
      [ownerId]
    );
    return rows;
  }

  async createPack(ownerId: string, name: string): Promise<PackSummary> {
    const { rows } = await this.query<PackSummary>(
      `INSERT INTO sticker_packs (owner_id, name, position)
       VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM sticker_packs WHERE owner_id = $1), 0))
       RETURNING id, name, position, created_at`,
      [ownerId, name]
    );
    return rows[0];
  }

  async updatePack(
    id: string,
    ownerId: string,
    fields: UpdatePackRequest,
  ): Promise<PackSummary | null> {
    const allowed = ['name', 'position'] as const;
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        params.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return null;
    params.push(id, ownerId);
    const { rows } = await this.query<PackSummary>(
      `UPDATE sticker_packs SET ${sets.join(', ')}
       WHERE id = $${idx} AND owner_id = $${idx + 1}
       RETURNING id, name, position, created_at`,
      params
    );
    return rows[0] || null;
  }

  async deletePack(id: string, ownerId: string): Promise<boolean> {
    const { rowCount } = await this.query(
      `DELETE FROM sticker_packs WHERE id = $1 AND owner_id = $2`,
      [id, ownerId]
    );
    return (rowCount ?? 0) > 0;
  }
}

export default new StickerRepository();
