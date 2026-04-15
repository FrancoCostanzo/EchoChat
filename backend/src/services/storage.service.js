const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../config/logger');
const { minioClient, publicMinioClient } = require('../config/minio');
const config = require('../config');
const { storageRepository } = require('../repositories');
const { NotFoundError } = require('../errors');
const { toStorageObjectResponse } = require('../models');

// Map object_type to bucket
const BUCKET_MAP = {
  image: 'messaging-images',
  video: 'messaging-videos',
  audio: 'messaging-audio',
  voice: 'messaging-audio',
  document: 'messaging-documents',
  thumbnail: 'messaging-thumbnails',
  recording: 'messaging-recordings',
  sticker: 'messaging-stickers',
  avatar: 'messaging-avatars',
  gif: 'messaging-images',
  other: 'messaging-documents',
};

class StorageService {
  getBucket(objectType) {
    return BUCKET_MAP[objectType] || 'messaging-documents';
  }

  generateObjectKey(objectType, originalFilename) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(originalFilename) || '';
    return `${objectType}s/${year}/${month}/${uuidv4()}${ext}`;
  }

  async upload(userId, fileBuffer, metadata) {
    const bucket = this.getBucket(metadata.object_type);
    const objectKey = this.generateObjectKey(metadata.object_type, metadata.original_filename);

    // Upload to MinIO
    await minioClient.putObject(bucket, objectKey, fileBuffer, metadata.file_size_bytes, {
      'Content-Type': metadata.mime_type,
    });

    // Register in DB
    const storageObj = await storageRepository.create({
      uploader_id: userId,
      bucket_name: bucket,
      object_key: objectKey,
      original_filename: metadata.original_filename,
      mime_type: metadata.mime_type,
      file_size_bytes: metadata.file_size_bytes,
      file_hash_sha256: metadata.file_hash_sha256 || null,
      object_type: metadata.object_type,
      image_width: metadata.image_width,
      image_height: metadata.image_height,
      duration_ms: metadata.duration_ms,
    });

    logger.info({ objectId: storageObj.id, bucket, objectKey }, 'File uploaded to MinIO');
    return toStorageObjectResponse(storageObj);
  }

  async getPresignedUrl(objectId, userId) {
    // Check cache
    const cached = await storageRepository.getCachedPresignedUrl(objectId, userId, 'get');
    if (cached) return cached.presigned_url;

    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');

    const ttl = 3600; // 1 hour
    const url = await publicMinioClient.presignedGetObject(obj.bucket_name, obj.object_key, ttl);

    const expiresAt = new Date(Date.now() + (ttl - 300) * 1000); // Cache for TTL - 5 min
    await storageRepository.saveCachedPresignedUrl(objectId, userId, 'get', url, expiresAt);

    return url;
  }

  async getUploadPresignedUrl(userId, metadata) {
    const bucket = this.getBucket(metadata.object_type);
    const objectKey = this.generateObjectKey(metadata.object_type, metadata.original_filename);
    const ttl = 3600;
    const url = await publicMinioClient.presignedPutObject(bucket, objectKey, ttl);
    return { url, bucket, objectKey };
  }

  async getById(objectId) {
    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');
    return toStorageObjectResponse(obj);
  }

  async delete(objectId) {
    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');

    await minioClient.removeObject(obj.bucket_name, obj.object_key);
    await storageRepository.deleteById(objectId);
    logger.info({ objectId }, 'Storage object deleted');
  }
}

module.exports = new StorageService();
