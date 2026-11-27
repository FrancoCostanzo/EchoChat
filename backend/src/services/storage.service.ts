import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../config/logger';
import { promises as fs } from 'fs';
import { storage, LocalStorageProvider } from '../config/storage';
import { storageRepository } from '../repositories';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toStorageObjectResponse } from '../models';
import mediaSafetyService from './mediaSafety.service';
import { createHash } from 'crypto';
import sharp from 'sharp';
import config from '../config';
import type { UploadMetadataRequest, StorageObjectType } from '../dtos/storage.dto';

/** Tipos que se deduplican. Avatares y fondos quedan afuera: se borran por id. */
const DEDUP_TYPES = new Set<string>(['image', 'video', 'audio', 'voice', 'document', 'gif', 'other']);

/** Lado máximo de la miniatura, y tamaño bajo el cual una imagen chica no la necesita. */
const THUMB_SIZE = 640;
const THUMB_MIN_BYTES = 150 * 1024;
const THUMB_TYPES = new Set<string>(['image']);
const THUMB_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']);

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
    // Hash del archivo tal como llegó: dos subidas iguales dan el mismo hash
    // aunque después se re-codifique para quitar el EXIF.
    const hash = metadata.file_hash_sha256 || createHash('sha256').update(fileBuffer).digest('hex');

    // Deduplicación (mismo usuario mandando el mismo archivo a varios chats).
    if (DEDUP_TYPES.has(metadata.object_type)) {
      const previous = await storageRepository.findReusable({
        hash,
        uploaderId: userId,
        filename: metadata.original_filename,
        mimeType: metadata.mime_type,
        objectType: metadata.object_type,
      });
      if (previous && this.scanStillValid(previous.virus_scan_status)) {
        logger.info({ objectId: previous.id }, 'Upload deduplicated');
        return toStorageObjectResponse(previous);
      }
    }

    // Antivirus + EXIF antes de guardar: un archivo infectado no llega al bucket.
    const clean = await mediaSafetyService.sanitize(fileBuffer, metadata.mime_type, {
      userId,
      filename: metadata.original_filename,
    });

    // Upload to storage
    await storage.putObject(bucket, objectKey, clean.buffer, clean.sizeBytes, metadata.mime_type);
    const thumbnail = await this.createThumbnail(clean.buffer, metadata.mime_type, metadata.object_type);

    // Register in DB
    const storageObj = await storageRepository.create({
      uploader_id: userId,
      bucket_name: bucket,
      object_key: objectKey,
      original_filename: metadata.original_filename,
      mime_type: metadata.mime_type,
      file_size_bytes: clean.sizeBytes,
      file_hash_sha256: hash,
      object_type: metadata.object_type,
      image_width: clean.width ?? metadata.image_width,
      image_height: clean.height ?? metadata.image_height,
      duration_ms: metadata.duration_ms,
      virus_scan_status: clean.virusScanStatus,
      exif_stripped: clean.exifStripped,
      thumbnail_key: thumbnail.key,
      processing_status: thumbnail.error ? 'failed' : 'ready',
      processing_error: thumbnail.error,
    });

    logger.info({ objectId: storageObj.id, bucket, objectKey }, 'File uploaded to storage');
    return toStorageObjectResponse(storageObj);
  }

  /**
   * ¿Sirve todavía el escaneo de una subida anterior? Un `skipped` o `error` de
   * cuando no había antivirus no alcanza si ahora sí lo hay: se vuelve a subir.
   */
  private scanStillValid(status: string | null): boolean {
    if (status === 'clean') return true;
    return !config.antivirus.host && (status === 'skipped' || status === 'error');
  }

  /**
   * Miniatura WebP (máx. THUMB_SIZE px) de una imagen fija, en el bucket de
   * miniaturas. Las imágenes chicas, los GIF y las animaciones no llevan: el
   * chat muestra el original. Si falla, la subida sigue igual.
   */
  async createThumbnail(buffer: Buffer, mimeType: string, objectType: string): Promise<{ key: string | null; error: string | null }> {
    if (!THUMB_TYPES.has(objectType) || !THUMB_MIMES.has(mimeType)) return { key: null, error: null };
    try {
      const meta = await sharp(buffer).metadata();
      if ((meta.pages ?? 1) > 1) return { key: null, error: null };
      const small = (meta.width ?? 0) <= THUMB_SIZE && (meta.height ?? 0) <= THUMB_SIZE;
      if (small && buffer.length <= THUMB_MIN_BYTES) return { key: null, error: null };

      const thumb = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const key = this.generateObjectKey('thumbnail', 'thumb.webp');
      await storage.putObject(BUCKET_MAP.thumbnail, key, thumb, thumb.length, 'image/webp');
      return { key, error: null };
    } catch (err) {
      logger.warn({ err, mimeType }, 'Could not create thumbnail');
      return { key: null, error: (err as Error).message.slice(0, 500) };
    }
  }

  /** URL firmada de la miniatura; si no tiene, la del original. */
  async getThumbnailUrl(objectId: string, userId: string | null): Promise<string> {
    const obj = await storageRepository.findById(objectId);
    if (!obj) throw new NotFoundError('Storage object');
    if (!obj.thumbnail_key) return this.getPresignedUrl(objectId, userId);
    // Firmar es local (no va a la red), así que no hace falta la caché de URLs.
    return storage.getSignedUrl(obj.thumbnail_bucket || BUCKET_MAP.thumbnail, obj.thumbnail_key, 3600);
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
    if (obj.thumbnail_bucket && obj.thumbnail_key) {
      try {
        await storage.removeObject(obj.thumbnail_bucket, obj.thumbnail_key);
      } catch (err) {
        logger.warn({ err: (err as Error).message, objectId }, 'Failed to delete thumbnail');
      }
    }
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
