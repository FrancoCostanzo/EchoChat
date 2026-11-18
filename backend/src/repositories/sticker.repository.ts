import { sql } from 'kysely';
import BaseRepository from './base.repository';
import { now, ilike } from '../config/db/sql';
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
  static COLLECTION_SELECT = [
    'us.id', 'us.storage_object_id', 'us.pack_id', 'us.name', 'us.keywords',
    'us.is_favorite', 'us.position', 'us.added_at',
    'so.mime_type', 'so.image_width', 'so.image_height',
  ] as const;

  // Full collection, optionally filtered by a free-text query over name + keywords.
  async listCollection(
    ownerId: string,
    { search = null }: { search?: string | null } = {},
  ): Promise<UserStickerRow[]> {
    const term = search && search.trim() ? search.trim() : null;
    let q = this.db.selectFrom('user_stickers as us')
      .innerJoin('storage_objects as so', 'so.id', 'us.storage_object_id')
      .select(StickerRepository.COLLECTION_SELECT)
      .where('us.owner_id', '=', ownerId);
    if (term) {
      const pattern = `%${term}%`;
      q = q.where((eb) => eb.or([
        ilike('us.name', pattern),
        // TODO(etapa 3): keywords es TEXT[]; con JSON se busca de otra forma.
        sql<boolean>`EXISTS (SELECT 1 FROM unnest(us.keywords) k WHERE k ILIKE ${pattern})`,
      ]));
    }
    return q
      .orderBy('us.is_favorite', 'desc')
      .orderBy('us.position', 'asc')
      .orderBy('us.added_at', 'desc')
      .execute() as unknown as Promise<UserStickerRow[]>;
  }

  // Recently used stickers still present in the user's collection.
  async listRecent(ownerId: string, limit = 16): Promise<UserStickerRow[]> {
    return this.db.selectFrom('sticker_usage as u')
      .innerJoin('user_stickers as us', (j) => j
        .onRef('us.owner_id', '=', 'u.owner_id')
        .onRef('us.storage_object_id', '=', 'u.storage_object_id'))
      .innerJoin('storage_objects as so', 'so.id', 'us.storage_object_id')
      .select(StickerRepository.COLLECTION_SELECT)
      .where('u.owner_id', '=', ownerId)
      .orderBy('u.last_used_at', 'desc')
      .limit(limit)
      .execute() as unknown as Promise<UserStickerRow[]>;
  }

  async findEntry(id: string, ownerId: string): Promise<StickerRow | null> {
    const row = await this.db.selectFrom('user_stickers').selectAll()
      .where('id', '=', id).where('owner_id', '=', ownerId)
      .executeTakeFirst();
    return (row as StickerRow | undefined) ?? null;
  }

  async findByOwnerAndObject(ownerId: string, storageObjectId: string): Promise<StickerRow | null> {
    const row = await this.db.selectFrom('user_stickers').selectAll()
      .where('owner_id', '=', ownerId).where('storage_object_id', '=', storageObjectId)
      .executeTakeFirst();
    return (row as StickerRow | undefined) ?? null;
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
    const row = await this.db.insertInto('user_stickers')
      .values({ owner_id: ownerId, storage_object_id: storageObjectId, pack_id: packId, name, keywords })
      .onConflict((oc) => oc.columns(['owner_id', 'storage_object_id'])
        .doUpdateSet((eb) => ({ added_at: eb.ref('user_stickers.added_at') })))
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as StickerRow;
  }

  // Partial update — only the provided fields are written.
  async updateEntry(
    id: string,
    ownerId: string,
    fields: UpdateStickerRequest & { position?: number },
  ): Promise<StickerRow | null> {
    const allowed = ['name', 'keywords', 'pack_id', 'is_favorite', 'position'] as const;
    const changes: Record<string, unknown> = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) changes[key] = fields[key];
    }
    if (Object.keys(changes).length === 0) return this.findEntry(id, ownerId);
    const row = await this.db.updateTable('user_stickers')
      .set(changes)
      .where('id', '=', id).where('owner_id', '=', ownerId)
      .returningAll()
      .executeTakeFirst();
    return (row as StickerRow | undefined) ?? null;
  }

  async deleteEntry(id: string, ownerId: string): Promise<string | null> {
    const row = await this.db.deleteFrom('user_stickers')
      .where('id', '=', id).where('owner_id', '=', ownerId)
      .returning('storage_object_id')
      .executeTakeFirst();
    return row?.storage_object_id || null;
  }

  async recordUsage(ownerId: string, storageObjectId: string): Promise<void> {
    await this.db.insertInto('sticker_usage')
      .values({ owner_id: ownerId, storage_object_id: storageObjectId, use_count: 1, last_used_at: now() })
      .onConflict((oc) => oc.columns(['owner_id', 'storage_object_id']).doUpdateSet((eb) => ({
        use_count: eb('sticker_usage.use_count', '+', 1),
        last_used_at: now(),
      })))
      .execute();
  }

  // ── Packs ──────────────────────────────────────────────────────────────
  async listPacks(ownerId: string): Promise<PackSummary[]> {
    return this.db.selectFrom('sticker_packs')
      .select(['id', 'name', 'position', 'created_at'])
      .where('owner_id', '=', ownerId)
      .orderBy('position', 'asc').orderBy('created_at', 'asc')
      .execute() as Promise<PackSummary[]>;
  }

  async createPack(ownerId: string, name: string): Promise<PackSummary> {
    const row = await this.db.insertInto('sticker_packs')
      .values((eb) => ({
        owner_id: ownerId,
        name,
        position: eb.fn.coalesce(
          eb.selectFrom('sticker_packs')
            .select((s) => s(s.fn.max('position'), '+', 1).as('next'))
            .where('owner_id', '=', ownerId),
          eb.lit(0),
        ),
      }))
      .returning(['id', 'name', 'position', 'created_at'])
      .executeTakeFirstOrThrow();
    return row as PackSummary;
  }

  async updatePack(
    id: string,
    ownerId: string,
    fields: UpdatePackRequest,
  ): Promise<PackSummary | null> {
    const allowed = ['name', 'position'] as const;
    const changes: Record<string, unknown> = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) changes[key] = fields[key];
    }
    if (Object.keys(changes).length === 0) return null;
    const row = await this.db.updateTable('sticker_packs')
      .set(changes)
      .where('id', '=', id).where('owner_id', '=', ownerId)
      .returning(['id', 'name', 'position', 'created_at'])
      .executeTakeFirst();
    return (row as PackSummary | undefined) ?? null;
  }

  async deletePack(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db.deleteFrom('sticker_packs')
      .where('id', '=', id).where('owner_id', '=', ownerId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

export default new StickerRepository();
