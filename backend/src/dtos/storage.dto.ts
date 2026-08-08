import Joi from 'joi';

export type StorageObjectType =
  | 'image' | 'video' | 'audio' | 'voice' | 'document'
  | 'thumbnail' | 'recording' | 'sticker' | 'avatar' | 'gif' | 'wallpaper' | 'other';

export interface UploadMetadataRequest {
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  object_type: StorageObjectType;
  image_width?: number | null;
  image_height?: number | null;
  duration_ms?: number | null;
}

export const uploadMetadataDto = Joi.object<UploadMetadataRequest>({
  original_filename: Joi.string().max(500).required(),
  mime_type: Joi.string().max(100).required(),
  file_size_bytes: Joi.number().integer().positive().required(),
  object_type: Joi.string().valid(
    'image', 'video', 'audio', 'voice', 'document',
    'thumbnail', 'recording', 'sticker', 'avatar', 'gif', 'wallpaper', 'other'
  ).required(),
  image_width: Joi.number().integer().positive().allow(null),
  image_height: Joi.number().integer().positive().allow(null),
  duration_ms: Joi.number().integer().positive().allow(null),
});
