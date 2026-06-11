const { wallpaperRepository } = require('../repositories');

class WallpaperService {
  async getAll(userId) {
    return wallpaperRepository.findAllForUser(userId);
  }

  async upsert(userId, data) {
    return wallpaperRepository.upsert(userId, data);
  }

  async remove(userId, scope, scopeKey) {
    return wallpaperRepository.deleteOne(userId, scope, scopeKey);
  }
}

module.exports = new WallpaperService();
