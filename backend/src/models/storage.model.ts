import type { Row } from '../types/rows';

export function toStorageObjectResponse(row: Row<'storage_objects'> | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    bucket_name: row.bucket_name,
    object_key: row.object_key,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    object_type: row.object_type,
    image_width: row.image_width,
    image_height: row.image_height,
    duration_ms: row.duration_ms,
    thumbnail_bucket: row.thumbnail_bucket,
    thumbnail_key: row.thumbnail_key,
    processing_status: row.processing_status,
    access_policy: row.access_policy,
    uploaded_at: row.uploaded_at,
  };
}

export type StorageObjectResponse = NonNullable<ReturnType<typeof toStorageObjectResponse>>;
