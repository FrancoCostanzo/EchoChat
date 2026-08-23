import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { stickerService } from '../services';
import { BadRequestError } from '../errors';
import { qStr, type AuthRequest } from '../types/http';

class StickerController {
  async list(req: AuthRequest, res: Response) {
    const data = await stickerService.getCollection(req.user.id, { search: qStr(req.query.search) || null });
    res.json({ status: 'success', data });
  }

  async upload(req: AuthRequest, res: Response) {
    if (!req.file) throw new BadRequestError('No file provided');
    const metadata = {
      original_filename: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size_bytes: req.file.size,
      image_width: req.body.image_width ? parseInt(req.body.image_width, 10) : null,
      image_height: req.body.image_height ? parseInt(req.body.image_height, 10) : null,
    };
    const data = await stickerService.uploadSticker(req.user.id, req.file.buffer, metadata);
    res.status(StatusCodes.CREATED).json({ status: 'success', data });
  }

  async save(req: AuthRequest, res: Response) {
    const data = await stickerService.saveReceived(req.user.id, req.body.object_id);
    res.status(StatusCodes.CREATED).json({ status: 'success', data });
  }

  async update(req: AuthRequest, res: Response) {
    const data = await stickerService.updateEntry(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data });
  }

  async remove(req: AuthRequest, res: Response) {
    await stickerService.remove(req.user.id, req.params.id);
    res.json({ status: 'success', message: 'Sticker removed' });
  }

  async use(req: AuthRequest, res: Response) {
    await stickerService.recordUsage(req.user.id, req.params.id);
    res.json({ status: 'success' });
  }

  async createPack(req: AuthRequest, res: Response) {
    const data = await stickerService.createPack(req.user.id, req.body.name);
    res.status(StatusCodes.CREATED).json({ status: 'success', data });
  }

  async updatePack(req: AuthRequest, res: Response) {
    const data = await stickerService.updatePack(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data });
  }

  async deletePack(req: AuthRequest, res: Response) {
    await stickerService.deletePack(req.user.id, req.params.id);
    res.json({ status: 'success', message: 'Pack deleted' });
  }
}

export default new StickerController();
