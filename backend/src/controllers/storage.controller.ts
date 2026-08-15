import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { storageService } from '../services';
import { BadRequestError } from '../errors';
import type { AuthRequest } from '../types/http';

class StorageController {
  async upload(req: AuthRequest, res: Response) {
    if (!req.file) throw new BadRequestError('No file provided');
    const fileBuffer = req.file.buffer;
    const metadata = {
      original_filename: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size_bytes: req.file.size,
      object_type: req.body.object_type,
      image_width: req.body.image_width ? parseInt(req.body.image_width, 10) : null,
      image_height: req.body.image_height ? parseInt(req.body.image_height, 10) : null,
      duration_ms: req.body.duration_ms ? parseInt(req.body.duration_ms, 10) : null,
    };
    const result = await storageService.upload(req.user.id, fileBuffer, metadata);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
  }

  async getPresignedUrl(req: AuthRequest, res: Response) {
    const url = await storageService.getPresignedUrl(req.params.objectId, req.user.id);
    res.json({ status: 'success', data: { url } });
  }

  async getUploadUrl(req: AuthRequest, res: Response) {
    const result = await storageService.getUploadPresignedUrl(req.user.id, req.body);
    res.json({ status: 'success', data: result });
  }

  async getById(req: AuthRequest, res: Response) {
    const obj = await storageService.getById(req.params.objectId);
    res.json({ status: 'success', data: obj });
  }

  async delete(req: AuthRequest, res: Response) {
    await storageService.delete(req.params.objectId);
    res.json({ status: 'success', message: 'Object deleted' });
  }
}

export = new StorageController();
