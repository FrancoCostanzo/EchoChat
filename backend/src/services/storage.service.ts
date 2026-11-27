import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../config/logger';
import { promises as fs } from 'fs';
import { storage, LocalStorageProvider } from '../config/storage';
import { storageRepository } from '../repositories';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toStorageObjectResponse } from '../models';
import mediaSafetyService from './mediaSafety.service';
import type { UploadMetadataRequest, StorageObjectType } from '../dtos/storage.dto';

// Map object_type to bucket
const BUCKET_MAP: Record<string, string> = {
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
  wallpaper: 'messaging-wallpapers',
  other: 'messaging-documents',
};

/** Metadatos de subida, más el hash opcional que calcula el controlador. */
export type UploadMetadata = UploadMetadataRequest & { file_hash_sha256?: string | null };

/** Firma que trae la query de una URL del driver local. */
export interface LocalSignature {
  exp: unknown;
  sig: unknown;
}

// Tipos que el navegador puede mostrar en línea; el resto se descarga. Junto con
// el CSP `sandbox`, evita que un HTML o SVG subido corra en el origen de la API.
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|avif|bmp)|video\/|audio\/|application\/pdf$|text\/plain$)/;

class StorageService {
  getBucket(objectType: StorageObjectType | string): string {
    return BUCKET_MAP[objectType] || 'messaging-documents';
  }

  generateObjectKey(objectType: string, originalFilename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(originalFilename) || '';
    return `${objectType}s/${year}/${month}/${uuidv4()}${ext}`;
  }

  async upload(userId: string, fileBuffer: Buffer, metadata: UploadMetadata) {
    const bucket = this.getBucket(metadata.object_type);
    const objectKey = this.generateObjectKey(metadata.object_type, metadata.original_filename);

    // Antivirus + EXIF antes de guardar: un archivo infectado no llega al bucket.
    const clean = await mediaSafetyService.sanitize(fileBuffer, metadata.mime_type, {
      userId,
      filename: metadata.original_filename,
    });

    // Upload to storage
    await storage.putObject(bucket, objectKey, clean.buffer, clean.sizeBytes, metadata.mime_type);

    // Register in DB
    const storageObj = await storageRepository.create({
      uploader_id: userId,
      bucket_name: bucket,
      object_key: objectKey,
      original_filename: metadata.original_filename,
      mime_type: metadata.mime_type,
      file_size_bytes: clean.sizeBytes,
      file_hash_sha256: metadata.file_hash_sha256 || null,
      object_type: metadata.object_type,
      image_width: clean.width ?? metadata.image_width,
      image_height: clean.height ?? metadata.image_height,
      duration_ms: metadata.duration_ms,
      virus_scan_status: clean.virusScanStatus,
      exif_stripped: clean.exifStripped,
    });

    logger.info({ objectId: storageObj.id, bucket, objectKey }, 'File uploaded to storage');
    return toStorageObjectResponse(storageObj);
  }

  async getPresignedUrl(objectId: string, userId: string | null): Promise<string> {
    // Check cache
    const cached = await storageRepository.getCachedPresignedUrl(objectId, userId, 'get');
    if (cached) return cached.presigned_url;

    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');

    const ttl = 3600; // 1 hour
    const url = await storage.getSignedUrl(obj.bucket_name, obj.object_key, ttl);

    const expiresAt = new Date(Date.now() + (ttl - 300) * 1000); // Cache for TTL - 5 min
    await storageRepository.saveCachedPresignedUrl(objectId, userId, 'get', url, expiresAt);

    return url;
  }

  async getUploadPresignedUrl(userId: string, metadata: UploadMetadata) {
    const bucket = this.getBucket(metadata.object_type);
    const objectKey = this.generateObjectKey(metadata.object_type, metadata.original_filename);
    const ttl = 3600;
    const url = await storage.getSignedUploadUrl(bucket, objectKey, ttl);
    return { url, bucket, objectKey };
  }

  async getById(objectId: string) {
    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');
    return toStorageObjectResponse(obj);
  }

  async delete(objectId: string): Promise<void> {
    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');

    await storage.removeObject(obj.bucket_name, obj.object_key);
    await storageRepository.deleteById(objectId);
    logger.info({ objectId }, 'Storage object deleted');
  }

  // ── Driver local: las URLs firmadas apuntan al propio backend ──────────────

  private localProvider(): LocalStorageProvider {
    // Con S3 la ruta no existe: las URLs firmadas van directo al bucket.
    if (!(storage instanceof LocalStorageProvider)) throw new NotFoundError('Route');
    return storage;
  }

  /** Archivo a servir para una URL de descarga firmada. */
  async getLocalFile(bucket: string, key: string, signature: LocalSignature) {
    const local = this.localProvider();
    if (!local.verify('get', bucket, key, signature.exp, signature.sig)) {
      throw new ForbiddenError('Invalid or expired link');
    }
    let filePath: string;
    try {
      filePath = local.resolvePath(bucket, key);
    } catch {
      throw new BadRequestError('Invalid object path');
    }
    const exists = await fs.stat(filePath).then((s) => s.isFile(), () => false);
    if (!exists) throw new NotFoundError('Storage object');

    const { contentType } = await local.readMeta(bucket, key);
    const type = contentType || 'application/octet-stream';
    return {
      filePath,
      contentType: type,
      inline: INLINE_TYPES.test(type),
      fileName: path.basename(key),
      expiresAt: Number(signature.exp),
    };
  }

  /** Guarda el cuerpo de un PUT a una URL de subida firmada. */
  async putLocalFile(bucket: string, key: string, signature: LocalSignature, body: Buffer, contentType?: string) {
    const local = this.localProvider();
    if (!local.verify('put', bucket, key, signature.exp, signature.sig)) {
      throw new ForbiddenError('Invalid or expired link');
    }
    try {
      local.resolvePath(bucket, key);
    } catch {
      throw new BadRequestError('Invalid object path');
    }
    await local.putObject(bucket, key, body, body.length, contentType);
  }

  /** Remove from storage + DB only when no other row references this object. */
  async deleteIfUnreferenced(objectId: string | null | undefined): Promise<boolean> {
    if (!objectId) return false;
    const refs = await storageRepository.countReferences(objectId);
    if (refs > 0) return false;
    try {
      await this.delete(objectId);
      return true;
    } catch (err) {
      if (err instanceof NotFoundError) return false;
      throw err;
    }
  }
}

export default new StorageService();
