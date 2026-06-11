const { wallpaperService } = require('../services');

class WallpaperController {
  async getAll(req, res) {
    const wallpapers = await wallpaperService.getAll(req.user.id);
    res.json({ status: 'success', data: wallpapers });
  }

  async upsert(req, res) {
    const wallpaper = await wallpaperService.upsert(req.user.id, req.body);
    res.json({ status: 'success', data: wallpaper });
  }

  async remove(req, res) {
    const { scope, scope_key } = req.params;
    await wallpaperService.remove(req.user.id, scope, scope_key);
    res.json({ status: 'success', message: 'Wallpaper removed' });
  }
}

module.exports = new WallpaperController();
