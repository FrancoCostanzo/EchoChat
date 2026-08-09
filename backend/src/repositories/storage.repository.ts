import BaseRepository from './base.repository';
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
    const { rows } = await this.query(
      `INSERT INTO storage_objects
        (uploader_id, bucket_name, object_key, original_filename, mime_type,
         file_size_bytes, file_hash_sha256, object_type, image_width, image_height, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [uploader_id, bucket_name, object_key, original_filename, mime_type,
       file_size_bytes, file_hash_sha256 || null, object_type,
       image_width || null, image_height || null, duration_ms || null]
    );
    return rows[0];
  }

  async findByHash(hash: string): Promise<StorageRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM storage_objects WHERE file_hash_sha256 = $1 LIMIT 1`,
      [hash]
    );
    return rows[0] || null;
  }

  /** Cuántas entidades referencian el objeto: si es 0, se puede borrar de MinIO. */
  async countReferences(objectId: string): Promise<number> {
    const { rows } = await this.query<{ ref_count: number }>(
      `SELECT (
         (SELECT COUNT(*) FROM user_wallpapers WHERE storage_object_id = $1) +
         (SELECT COUNT(*) FROM user_stickers WHERE storage_object_id = $1) +
         (SELECT COUNT(*) FROM message_attachments WHERE object_id = $1) +
         (SELECT COUNT(*) FROM conversations WHERE avatar_object_id = $1) +
         (SELECT COUNT(*) FROM call_recordings WHERE object_id = $1) +
         (SELECT COUNT(*) FROM broadcast_messages WHERE object_id = $1)
       )::int AS ref_count`,
      [objectId]
    );
    return parseInt(String(rows[0].ref_count), 10);
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    error: string | null = null,
  ): Promise<StorageRow> {
    const { rows } = await this.query(
      `UPDATE storage_objects
       SET processing_status = $1, processing_error = $2, processed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, error, id]
    );
    return rows[0];
  }

  async updateThumbnail(id: string, thumbnailKey: string): Promise<StorageRow> {
    const { rows } = await this.query(
      `UPDATE storage_objects SET thumbnail_key = $1 WHERE id = $2 RETURNING *`,
      [thumbnailKey, id]
    );
    return rows[0];
  }

  async findPending(limit = 10): Promise<StorageRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM storage_objects
       WHERE processing_status = 'pending'
       ORDER BY uploaded_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async saveCachedPresignedUrl(
    objectId: string,
    userId: string | null,
    operation: string,
    url: string,
    expiresAt: Date,
  ): Promise<PresignedRow> {
    const { rows } = await this.query<PresignedRow>(
      `INSERT INTO storage_presigned_urls (object_id, user_id, operation, presigned_url, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_id, user_id, operation) DO UPDATE
       SET presigned_url = $4, expires_at = $5, created_at = NOW()
       RETURNING *`,
      [objectId, userId || null, operation, url, expiresAt]
    );
    return rows[0];
  }

  async getCachedPresignedUrl(
    objectId: string,
    userId: string | null,
    operation: string,
  ): Promise<PresignedRow | null> {
    const { rows } = await this.query<PresignedRow>(
      `SELECT * FROM storage_presigned_urls
       WHERE object_id = $1 AND user_id = $2 AND operation = $3 AND expires_at > NOW()`,
      [objectId, userId, operation]
    );
    return rows[0] || null;
  }

  async getStats() {
    const { rows } = await this.query<{
      total_objects: number;
      total_bytes: string;
      pending_processing: number;
      failed_processing: number;
    }>(
      `SELECT
         COUNT(*)::int AS total_objects,
         COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes,
         COUNT(*) FILTER (WHERE processing_status = 'pending')::int AS pending_processing,
         COUNT(*) FILTER (WHERE processing_status = 'failed')::int AS failed_processing
       FROM storage_objects`
    );
    const byBucket = await this.query<StorageBucketStat>(
      `SELECT bucket_name,
              COUNT(*)::int AS object_count,
              COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes
       FROM storage_objects
       GROUP BY bucket_name
       ORDER BY total_bytes DESC`
    );
    const byType = await this.query<StorageTypeStat>(
      `SELECT object_type,
              COUNT(*)::int AS object_count,
              COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes
       FROM storage_objects
       GROUP BY object_type
       ORDER BY object_count DESC`
    );
    return { summary: rows[0], by_bucket: byBucket.rows, by_type: byType.rows };
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
    const conditions = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (bucket) {
      conditions.push(`bucket_name = $${idx}`);
      params.push(bucket);
      idx++;
    }
    if (object_type) {
      conditions.push(`object_type = $${idx}`);
      params.push(object_type);
      idx++;
    }
    if (processing_status) {
      conditions.push(`processing_status = $${idx}`);
      params.push(processing_status);
      idx++;
    }

    params.push(limit, offset);
    const { rows } = await this.query<StorageObjectAdminRow>(
      `SELECT so.*, u.display_name AS uploader_display_name
       FROM storage_objects so
       LEFT JOIN users u ON u.id = so.uploader_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY so.uploaded_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  }
}

export = new StorageRepository();
