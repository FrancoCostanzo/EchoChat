import BaseRepository from './base.repository';
import { now } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { StorageObjectAdminRow } from '../models/admin.model';
import type { StorageObjectType } from '../dtos/storage.dto';

type StorageRow = Row<'storage_objects'>;
type PresignedRow = Row<'storage_presigned_urls'>;

/** Los SUM()/COUNT() de pg vuelven como string cuando son bigint. */
export interface StorageBucketStat {
  bucket_name: string;
  object_count: number;
  total_bytes: string;
}
export interface StorageTypeStat {
  object_type: string;
  object_count: number;
  total_bytes: string;
}

class StorageRepository extends BaseRepository<StorageRow> {
  constructor() {
    super('storage_objects');
  }

  async create(
    { uploader_id, bucket_name, object_key, original_filename, mime_type, file_size_bytes,
      file_hash_sha256, object_type, image_width, image_height, duration_ms }: {
      uploader_id: string | null;
      bucket_name: string;
      object_key: string;
      original_filename: string;
      mime_type: string;
      file_size_bytes: number;
      file_hash_sha256?: string | null;
      object_type: StorageObjectType | string;
      image_width?: number | null;
      image_height?: number | null;
      duration_ms?: number | null;
    },
  ): Promise<StorageRow> {
    const row = await this.db.insertInto('storage_objects')
      .values({
        uploader_id,
        bucket_name,
        object_key,
        original_filename,
        mime_type,
        file_size_bytes,
        file_hash_sha256: file_hash_sha256 || null,
        object_type,
        image_width: image_width || null,
        image_height: image_height || null,
        duration_ms: duration_ms || null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as StorageRow;
  }

  async findByHash(hash: string): Promise<StorageRow | null> {
    const row = await this.db.selectFrom('storage_objects').selectAll()
      .where('file_hash_sha256', '=', hash)
      .limit(1)
      .executeTakeFirst();
    return (row as StorageRow | undefined) ?? null;
  }

  /** Cuántas entidades referencian el objeto: si es 0, se puede borrar del almacenamiento. */
  async countReferences(objectId: string): Promise<number> {
    const refs = [
      ['user_wallpapers', 'storage_object_id'],
      ['user_stickers', 'storage_object_id'],
      ['message_attachments', 'object_id'],
      ['conversations', 'avatar_object_id'],
      ['call_recordings', 'object_id'],
      ['broadcast_messages', 'object_id'],
    ] as const;
    let total = 0;
    for (const [table, column] of refs) {
      const { n } = await (this.db as any).selectFrom(table)
        .select((eb: any) => eb.fn.countAll().as('n'))
        .where(column, '=', objectId)
        .executeTakeFirstOrThrow();
      total += Number(n);
    }
    return total;
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    error: string | null = null,
  ): Promise<StorageRow> {
    const row = await this.db.updateTable('storage_objects')
      .set({ processing_status: status, processing_error: error, processed_at: now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as StorageRow;
  }

  async updateThumbnail(id: string, thumbnailKey: string): Promise<StorageRow> {
    const row = await this.db.updateTable('storage_objects')
      .set({ thumbnail_key: thumbnailKey })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as StorageRow;
  }

  async findPending(limit = 10): Promise<StorageRow[]> {
    return this.db.selectFrom('storage_objects').selectAll()
      .where('processing_status', '=', 'pending')
      .orderBy('uploaded_at', 'asc')
      .limit(limit)
      .execute() as Promise<StorageRow[]>;
  }

  async saveCachedPresignedUrl(
    objectId: string,
    userId: string | null,
    operation: string,
    url: string,
    expiresAt: Date,
  ): Promise<PresignedRow> {
    const row = await this.db.insertInto('storage_presigned_urls')
      .values({ object_id: objectId, user_id: userId || null, operation, presigned_url: url, expires_at: expiresAt })
      .onConflict((oc) => oc.columns(['object_id', 'user_id', 'operation'])
        .doUpdateSet({ presigned_url: url, expires_at: expiresAt, created_at: now() }))
      .returningAll()
      .executeTakeFirst();
    return row as PresignedRow;
  }

  async getCachedPresignedUrl(
    objectId: string,
    userId: string | null,
    operation: string,
  ): Promise<PresignedRow | null> {
    // Igual que antes: con userId null no hay coincidencia (NULL = NULL es falso).
    const row = await this.db.selectFrom('storage_presigned_urls').selectAll()
      .where('object_id', '=', objectId)
      .where('user_id', '=', userId as string)
      .where('operation', '=', operation)
      .where('expires_at', '>', now())
      .executeTakeFirst();
    return (row as PresignedRow | undefined) ?? null;
  }

  /** Borra las URLs prefirmadas vencidas de la caché. Devuelve cuántas. */
  async deleteExpiredPresignedUrls(): Promise<number> {
    const result = await this.db.deleteFrom('storage_presigned_urls').where('expires_at', '<', now()).executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  async getStats() {
    const summary = await this.db.selectFrom('storage_objects')
      .select((eb) => [
        eb.cast<number>(eb.fn.countAll(), 'integer').as('total_objects'),
        eb.cast<string>(eb.fn.coalesce(eb.fn.sum('file_size_bytes'), eb.lit(0)), 'bigint').as('total_bytes'),
        eb.cast<number>(eb.fn.sum(eb.case().when('processing_status', '=', 'pending').then(1).else(0).end()), 'integer')
          .as('pending_processing'),
        eb.cast<number>(eb.fn.sum(eb.case().when('processing_status', '=', 'failed').then(1).else(0).end()), 'integer')
          .as('failed_processing'),
      ])
      .executeTakeFirstOrThrow();
    // SUM de cero filas da NULL: COUNT(*) FILTER daba 0.
    summary.pending_processing = summary.pending_processing ?? 0;
    summary.failed_processing = summary.failed_processing ?? 0;

    const byBucket = await this.db.selectFrom('storage_objects')
      .select((eb) => [
        'bucket_name',
        eb.cast<number>(eb.fn.countAll(), 'integer').as('object_count'),
        eb.cast<string>(eb.fn.coalesce(eb.fn.sum('file_size_bytes'), eb.lit(0)), 'bigint').as('total_bytes'),
      ])
      .groupBy('bucket_name')
      .orderBy('total_bytes', 'desc')
      .execute() as StorageBucketStat[];
    const byType = await this.db.selectFrom('storage_objects')
      .select((eb) => [
        'object_type',
        eb.cast<number>(eb.fn.countAll(), 'integer').as('object_count'),
        eb.cast<string>(eb.fn.coalesce(eb.fn.sum('file_size_bytes'), eb.lit(0)), 'bigint').as('total_bytes'),
      ])
      .groupBy('object_type')
      .orderBy('object_count', 'desc')
      .execute() as StorageTypeStat[];
    return { summary, by_bucket: byBucket, by_type: byType };
  }

  async listObjects(
    { bucket, object_type, processing_status, limit = 50, offset = 0 }: {
      bucket?: string;
      object_type?: string;
      processing_status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<StorageObjectAdminRow[]> {
    let q = this.db.selectFrom('storage_objects as so')
      .leftJoin('users as u', 'u.id', 'so.uploader_id')
      .selectAll('so')
      .select('u.display_name as uploader_display_name');
    if (bucket) q = q.where('so.bucket_name', '=', bucket);
    if (object_type) q = q.where('so.object_type', '=', object_type);
    if (processing_status) q = q.where('so.processing_status', '=', processing_status);
    return q.orderBy('so.uploaded_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<StorageObjectAdminRow[]>;
  }
}

export default new StorageRepository();
