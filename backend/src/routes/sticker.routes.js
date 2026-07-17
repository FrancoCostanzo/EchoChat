const { Router } = require('express');
const multer = require('multer');
const { stickerController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const { saveStickerDto, updateStickerDto, createPackDto, updatePackDto } = require('../dtos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — animated stickers need headroom
});

const router = Router();
router.use(authenticate);

// Packs — static segments must precede the generic /:id routes.
router.post('/packs', validate(createPackDto), (req, res) => stickerController.createPack(req, res));
router.patch('/packs/:id', validate(updatePackDto), (req, res) => stickerController.updatePack(req, res));
router.delete('/packs/:id', (req, res) => stickerController.deletePack(req, res));

router.get('/', (req, res) => stickerController.list(req, res));
router.post('/upload', requirePermission('media.upload'), upload.single('file'), (req, res) => stickerController.upload(req, res));
router.post('/save', validate(saveStickerDto), (req, res) => stickerController.save(req, res));

router.patch('/:id', validate(updateStickerDto), (req, res) => stickerController.update(req, res));
router.delete('/:id', (req, res) => stickerController.remove(req, res));
router.post('/:id/use', (req, res) => stickerController.use(req, res));

module.exports = router;
