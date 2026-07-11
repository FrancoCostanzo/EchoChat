const { StatusCodes } = require('http-status-codes');
const { storageService } = require('../services');

class StorageController {
  async upload(req, res) {
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

  async getPresignedUrl(req, res) {
    const url = await storageService.getPresignedUrl(req.params.objectId, req.user.id);
    res.json({ status: 'success', data: { url } });
  }

  async getUploadUrl(req, res) {
    const result = await storageService.getUploadPresignedUrl(req.user.id, req.body);
    res.json({ status: 'success', data: result });
  }

  async listStickers(req, res) {
    const data = await storageService.listUserStickers(req.user.id);
    res.json({ status: 'success', data });
  }

  async deleteSticker(req, res) {
    await storageService.deleteUserSticker(req.user.id, req.params.objectId);
    res.json({ status: 'success', message: 'Sticker deleted' });
  }

  async getById(req, res) {
    const obj = await storageService.getById(req.params.objectId);
    res.json({ status: 'success', data: obj });
  }

  async delete(req, res) {
    await storageService.delete(req.params.objectId);
    res.json({ status: 'success', message: 'Object deleted' });
  }
}

module.exports = new StorageController();
