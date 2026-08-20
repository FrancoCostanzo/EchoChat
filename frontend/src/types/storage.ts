/**
 * Contrato de /storage. Fuente de verdad en el backend:
 * backend/src/models/storage.model.ts (toStorageObjectResponse) y
 * backend/src/dtos/storage.dto.ts (UploadMetadataRequest). Ver la nota de
 * sincronización en types/user.ts.
 */
export type StorageObjectType =
  | 'image' | 'video' | 'audio' | 'voice' | 'document'
  | 'thumbnail' | 'recording' | 'sticker' | 'avatar' | 'gif' | 'wallpaper' | 'other';
export interface StorageObjectResponse {
  id: string;
  bucket_name: string;
  object_key: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  object_type: string;
  image_width: number | null;
  image_height: number | null;
  duration_ms: number | null;
  thumbnail_bucket: string | null;
  thumbnail_key: string | null;
  processing_status: string;
  access_policy: string;
  uploaded_at: string | null;
}

export interface UploadMetadataRequest {
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  object_type: StorageObjectType;
  image_width?: number | null;
  image_height?: number | null;
  duration_ms?: number | null;
}
