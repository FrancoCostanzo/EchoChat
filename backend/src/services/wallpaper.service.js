const logger = require('../config/logger');
const { wallpaperRepository } = require('../repositories');
const storageService = require('./storage.service');

class WallpaperService {
  async getAll(userId) {
    return wallpaperRepository.findAllForUser(userId);
  }

  async upsert(userId, data) {
    const existing = await wallpaperRepository.findOne(userId, data.scope, data.scope_key);
    const wallpaper = await wallpaperRepository.upsert(userId, data);

    const oldId = existing?.storage_object_id;
    const newId = wallpaper.storage_object_id;
    if (oldId && oldId !== newId) {
      storageService.deleteIfUnreferenced(oldId).catch((err) => {
        logger.warn({ err, objectId: oldId }, 'Failed to delete replaced wallpaper object');
      });
    }

    return wallpaper;
  }

  async remove(userId, scope, scopeKey) {
    const existing = await wallpaperRepository.findOne(userId, scope, scopeKey);
    const removed = await wallpaperRepository.deleteOne(userId, scope, scopeKey);

    if (removed && existing?.storage_object_id) {
      await storageService.deleteIfUnreferenced(existing.storage_object_id).catch((err) => {
        logger.warn({ err, objectId: existing.storage_object_id }, 'Failed to delete removed wallpaper object');
      });
    }

    return removed;
  }
}

module.exports = new WallpaperService();
