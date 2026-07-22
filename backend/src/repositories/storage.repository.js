const BaseRepository = require('./base.repository');

class StorageRepository extends BaseRepository {
  constructor() {
    super('storage_objects');
  }

  async create({ uploader_id, bucket_name, object_key, original_filename, mime_type, file_size_bytes, file_hash_sha256, object_type, image_width, image_height, duration_ms }) {
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

  async findByHash(hash) {
    const { rows } = await this.query(
      `SELECT * FROM storage_objects WHERE file_hash_sha256 = $1 LIMIT 1`,
      [hash]
    );
    return rows[0] || null;
  }

  async countReferences(objectId) {
    const { rows } = await this.query(
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
    return parseInt(rows[0].ref_count, 10);
  }

  async updateProcessingStatus(id, status, error = null) {
    const { rows } = await this.query(
      `UPDATE storage_objects
       SET processing_status = $1, processing_error = $2, processed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, error, id]
    );
    return rows[0];
  }

  async updateThumbnail(id, thumbnailKey) {
    const { rows } = await this.query(
      `UPDATE storage_objects SET thumbnail_key = $1 WHERE id = $2 RETURNING *`,
      [thumbnailKey, id]
    );
    return rows[0];
  }

  async findPending(limit = 10) {
    const { rows } = await this.query(
      `SELECT * FROM storage_objects
       WHERE processing_status = 'pending'
       ORDER BY uploaded_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async saveCachedPresignedUrl(objectId, userId, operation, url, expiresAt) {
    const { rows } = await this.query(
      `INSERT INTO storage_presigned_urls (object_id, user_id, operation, presigned_url, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (object_id, user_id, operation) DO UPDATE
       SET presigned_url = $4, expires_at = $5, created_at = NOW()
       RETURNING *`,
      [objectId, userId || null, operation, url, expiresAt]
    );
    return rows[0];
  }

  async getCachedPresignedUrl(objectId, userId, operation) {
    const { rows } = await this.query(
      `SELECT * FROM storage_presigned_urls
       WHERE object_id = $1 AND user_id = $2 AND operation = $3 AND expires_at > NOW()`,
      [objectId, userId, operation]
    );
    return rows[0] || null;
  }

  async getStats() {
    const { rows } = await this.query(
      `SELECT
         COUNT(*)::int AS total_objects,
         COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes,
         COUNT(*) FILTER (WHERE processing_status = 'pending')::int AS pending_processing,
         COUNT(*) FILTER (WHERE processing_status = 'failed')::int AS failed_processing
       FROM storage_objects`
    );
    const byBucket = await this.query(
      `SELECT bucket_name,
              COUNT(*)::int AS object_count,
              COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes
       FROM storage_objects
       GROUP BY bucket_name
       ORDER BY total_bytes DESC`
    );
    const byType = await this.query(
      `SELECT object_type,
              COUNT(*)::int AS object_count,
              COALESCE(SUM(file_size_bytes), 0)::bigint AS total_bytes
       FROM storage_objects
       GROUP BY object_type
       ORDER BY object_count DESC`
    );
    return { summary: rows[0], by_bucket: byBucket.rows, by_type: byType.rows };
  }

  async listObjects({ bucket, object_type, processing_status, limit = 50, offset = 0 } = {}) {
    const conditions = ['1=1'];
    const params = [];
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
    const { rows } = await this.query(
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

module.exports = new StorageRepository();
