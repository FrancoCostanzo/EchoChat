const { Router } = require('express');
const multer = require('multer');
const { storageController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const { uploadMetadataDto } = require('../dtos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

const router = Router();
router.use(authenticate);

router.post('/upload', requirePermission('media.upload'), upload.single('file'), (req, res) => storageController.upload(req, res));
router.post('/upload-url', requirePermission('media.upload'), validate(uploadMetadataDto), (req, res) => storageController.getUploadUrl(req, res));

// Custom stickers — static segments must precede the generic /:objectId routes.
router.get('/stickers', (req, res) => storageController.listStickers(req, res));
router.delete('/stickers/:objectId', (req, res) => storageController.deleteSticker(req, res));

router.get('/:objectId', (req, res) => storageController.getById(req, res));
router.get('/:objectId/url', (req, res) => storageController.getPresignedUrl(req, res));
router.delete('/:objectId', (req, res) => storageController.delete(req, res));

module.exports = router;
