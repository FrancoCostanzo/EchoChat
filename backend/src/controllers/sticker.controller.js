const { StatusCodes } = require('http-status-codes');
const { stickerService } = require('../services');

class StickerController {
  async list(req, res) {
    const data = await stickerService.getCollection(req.user.id, { search: req.query.search || null });
    res.json({ status: 'success', data });
  }

  async upload(req, res) {
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

  async save(req, res) {
    const data = await stickerService.saveReceived(req.user.id, req.body.object_id);
    res.status(StatusCodes.CREATED).json({ status: 'success', data });
  }

  async update(req, res) {
    const data = await stickerService.updateEntry(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data });
  }

  async remove(req, res) {
    await stickerService.remove(req.user.id, req.params.id);
    res.json({ status: 'success', message: 'Sticker removed' });
  }

  async use(req, res) {
    await stickerService.recordUsage(req.user.id, req.params.id);
    res.json({ status: 'success' });
  }

  async createPack(req, res) {
    const data = await stickerService.createPack(req.user.id, req.body.name);
    res.status(StatusCodes.CREATED).json({ status: 'success', data });
  }

  async updatePack(req, res) {
    const data = await stickerService.updatePack(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data });
  }

  async deletePack(req, res) {
    await stickerService.deletePack(req.user.id, req.params.id);
    res.json({ status: 'success', message: 'Pack deleted' });
  }
}

module.exports = new StickerController();
