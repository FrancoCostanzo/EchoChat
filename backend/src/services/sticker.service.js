const crypto = require('crypto');
const logger = require('../config/logger');
const { stickerRepository, storageRepository } = require('../repositories');
const storageService = require('./storage.service');
const { NotFoundError, BadRequestError } = require('../errors');
const { toUserStickerResponse, toStickerPackResponse } = require('../models');

// Sticker formats we allow in a personal collection. Covers static and
// animated images; the browser's <img> renders animated webp/gif/apng natively.
const ALLOWED_STICKER_MIMES = new Set([
  'image/webp', 'image/png', 'image/gif', 'image/jpeg',
]);

class StickerService {
  // Resolve a presigned URL for each row and shape the response.
  async _withUrls(rows, userId) {
    return Promise.all(
      rows.map(async (r) => toUserStickerResponse(r, await storageService.getPresignedUrl(r.storage_object_id, userId))),
    );
  }

  async getCollection(userId, { search = null } = {}) {
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
  async uploadSticker(userId, fileBuffer, metadata) {
    if (!ALLOWED_STICKER_MIMES.has(metadata.mime_type)) {
      throw new BadRequestError('Unsupported sticker format');
    }
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let objectId;
    const existing = await storageRepository.findByHash(hash);
    if (existing) {
      objectId = existing.id;
    } else {
      const obj = await storageService.upload(userId, fileBuffer, {
        ...metadata,
        object_type: 'sticker',
        file_hash_sha256: hash,
      });
      objectId = obj.id;
    }

    const entry = await stickerRepository.addEntry({ ownerId: userId, storageObjectId: objectId });
    const url = await storageService.getPresignedUrl(objectId, userId);
    logger.info({ userId, objectId, reused: !!existing }, 'Custom sticker added');
    return toUserStickerResponse({ ...entry, mime_type: metadata.mime_type, image_width: metadata.image_width, image_height: metadata.image_height }, url);
  }

  // Save a sticker received from someone else into my collection. The MinIO
  // object is shared by reference — no copy is made.
  async saveReceived(userId, objectId) {
    const obj = await storageRepository.findById(objectId);
    if (!obj || obj.object_type !== 'sticker') throw new NotFoundError('Sticker');
    const entry = await stickerRepository.addEntry({ ownerId: userId, storageObjectId: objectId });
    const url = await storageService.getPresignedUrl(objectId, userId);
    return toUserStickerResponse({ ...entry, mime_type: obj.mime_type, image_width: obj.image_width, image_height: obj.image_height }, url);
  }

  async updateEntry(userId, id, fields) {
    const updated = await stickerRepository.updateEntry(id, userId, fields);
    if (!updated) throw new NotFoundError('Sticker');
    // Re-read joined dimensions for a consistent response.
    const obj = await storageRepository.findById(updated.storage_object_id);
    const url = await storageService.getPresignedUrl(updated.storage_object_id, userId);
    return toUserStickerResponse({ ...updated, mime_type: obj?.mime_type, image_width: obj?.image_width, image_height: obj?.image_height }, url);
  }

  async remove(userId, id) {
    const objectId = await stickerRepository.deleteEntry(id, userId);
    if (!objectId) throw new NotFoundError('Sticker');
    // Only drops the MinIO object when nothing else references it (other users'
    // collections, sent messages, etc.).
    await storageService.deleteIfUnreferenced(objectId);
  }

  async recordUsage(userId, id) {
    const entry = await stickerRepository.findEntry(id, userId);
    if (!entry) throw new NotFoundError('Sticker');
    await stickerRepository.recordUsage(userId, entry.storage_object_id);
  }

  // ── Packs ──────────────────────────────────────────────────────────────
  async createPack(userId, name) {
    return toStickerPackResponse(await stickerRepository.createPack(userId, name));
  }

  async updatePack(userId, id, fields) {
    const pack = await stickerRepository.updatePack(id, userId, fields);
    if (!pack) throw new NotFoundError('Sticker pack');
    return toStickerPackResponse(pack);
  }

  async deletePack(userId, id) {
    const ok = await stickerRepository.deletePack(id, userId);
    if (!ok) throw new NotFoundError('Sticker pack');
  }
}

module.exports = new StickerService();
