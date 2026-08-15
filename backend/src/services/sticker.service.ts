import crypto from 'crypto';
import logger from '../config/logger';
import { stickerRepository, storageRepository } from '../repositories';
import storageService, { type UploadMetadata } from './storage.service';
import { NotFoundError, BadRequestError } from '../errors';
import { toUserStickerResponse, toStickerPackResponse } from '../models';
import type { UserStickerRow } from '../models/sticker.model';
import type { UpdateStickerRequest, UpdatePackRequest } from '../dtos/sticker.dto';

// Sticker formats we allow in a personal collection. Covers static and
// animated images; the browser's <img> renders animated webp/gif/apng natively.
const ALLOWED_STICKER_MIMES = new Set([
  'image/webp', 'image/png', 'image/gif', 'image/jpeg',
]);

class StickerService {
  // Resolve a presigned URL for each row and shape the response.
  async _withUrls(rows: UserStickerRow[], userId: string) {
    return Promise.all(
      rows.map(async (r) => toUserStickerResponse(r, await storageService.getPresignedUrl(r.storage_object_id, userId))),
    );
  }

  async getCollection(userId: string, { search = null }: { search?: string | null } = {}) {
    const [packRows, stickerRows, recentRows] = await Promise.all([
      stickerRepository.listPacks(userId),
      stickerRepository.listCollection(userId, { search }),
      // Recents ignore the search filter — they're a quick-access shortcut.
      stickerRepository.listRecent(userId),
    ]);
    const [stickers, recents] = await Promise.all([
      this._withUrls(stickerRows, userId),
      this._withUrls(recentRows, userId),
    ]);
    return {
      packs: packRows.map(toStickerPackResponse),
      stickers,
      recents,
    };
  }

  // Upload a new custom sticker. Deduplicates by SHA-256: if the same artwork
  // already exists in storage it is reused instead of uploaded again.
  // `object_type` no entra por parámetro: lo fija esta función más abajo, así
  // que pedirlo obligaba al controller a mandar un valor que se descartaba.
  async uploadSticker(
    userId: string,
    fileBuffer: Buffer,
    metadata: Omit<UploadMetadata, 'object_type'>,
  ) {
    if (!ALLOWED_STICKER_MIMES.has(metadata.mime_type)) {
      throw new BadRequestError('Unsupported sticker format');
    }
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let objectId: string;
    const existing = await storageRepository.findByHash(hash);
    if (existing) {
      objectId = existing.id;
    } else {
      const obj = await storageService.upload(userId, fileBuffer, {
        ...metadata,
        object_type: 'sticker',
        file_hash_sha256: hash,
      });
      objectId = obj!.id;
    }

    const entry = await stickerRepository.addEntry({ ownerId: userId, storageObjectId: objectId });
    const url = await storageService.getPresignedUrl(objectId, userId);
    logger.info({ userId, objectId, reused: !!existing }, 'Custom sticker added');
    return toUserStickerResponse({ ...entry, mime_type: metadata.mime_type, image_width: metadata.image_width, image_height: metadata.image_height }, url);
  }

  // Save a sticker received from someone else into my collection. The MinIO
  // object is shared by reference — no copy is made.
  async saveReceived(userId: string, objectId: string) {
    const obj = await storageRepository.findById(objectId);
    if (!obj || obj.object_type !== 'sticker') throw new NotFoundError('Sticker');
    const entry = await stickerRepository.addEntry({ ownerId: userId, storageObjectId: objectId });
    const url = await storageService.getPresignedUrl(objectId, userId);
    return toUserStickerResponse({ ...entry, mime_type: obj.mime_type, image_width: obj.image_width, image_height: obj.image_height }, url);
  }

  async updateEntry(userId: string, id: string, fields: UpdateStickerRequest) {
    const updated = await stickerRepository.updateEntry(id, userId, fields);
    if (!updated) throw new NotFoundError('Sticker');
    // Re-read joined dimensions for a consistent response.
    const obj = await storageRepository.findById(updated.storage_object_id);
    const url = await storageService.getPresignedUrl(updated.storage_object_id, userId);
    return toUserStickerResponse({ ...updated, mime_type: obj?.mime_type, image_width: obj?.image_width, image_height: obj?.image_height }, url);
  }

  async remove(userId: string, id: string): Promise<void> {
    const objectId = await stickerRepository.deleteEntry(id, userId);
    if (!objectId) throw new NotFoundError('Sticker');
    // Only drops the MinIO object when nothing else references it (other users'
    // collections, sent messages, etc.).
    await storageService.deleteIfUnreferenced(objectId);
  }

  async recordUsage(userId: string, id: string): Promise<void> {
    const entry = await stickerRepository.findEntry(id, userId);
    if (!entry) throw new NotFoundError('Sticker');
    await stickerRepository.recordUsage(userId, entry.storage_object_id);
  }

  // ── Packs ──────────────────────────────────────────────────────────────
  async createPack(userId: string, name: string) {
    return toStickerPackResponse(await stickerRepository.createPack(userId, name));
  }

  async updatePack(userId: string, id: string, fields: UpdatePackRequest) {
    const pack = await stickerRepository.updatePack(id, userId, fields);
    if (!pack) throw new NotFoundError('Sticker pack');
    return toStickerPackResponse(pack);
  }

  async deletePack(userId: string, id: string): Promise<void> {
    const ok = await stickerRepository.deletePack(id, userId);
    if (!ok) throw new NotFoundError('Sticker pack');
  }
}

export default new StickerService();
