import type { Response } from 'express';
import { wallpaperService } from '../services';
import type { AuthRequest } from '../types/http';

class WallpaperController {
  async getAll(req: AuthRequest, res: Response) {
    const wallpapers = await wallpaperService.getAll(req.user.id);
    res.json({ status: 'success', data: wallpapers });
  }

  async upsert(req: AuthRequest, res: Response) {
    const wallpaper = await wallpaperService.upsert(req.user.id, req.body);
    res.json({ status: 'success', data: wallpaper });
  }

  async remove(req: AuthRequest, res: Response) {
    const { scope, scope_key } = req.params;
    await wallpaperService.remove(req.user.id, scope, scope_key);
    res.json({ status: 'success', message: 'Wallpaper removed' });
  }
}

export default new WallpaperController();
