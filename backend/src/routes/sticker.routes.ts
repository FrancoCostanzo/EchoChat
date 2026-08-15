import { Router } from 'express';
import multer from 'multer';
import { stickerController } from '../controllers';
import { validate, authenticate, requirePermission } from '../middlewares';
import { saveStickerDto, updateStickerDto, createPackDto, updatePackDto } from '../dtos';
import { withAuth } from '../types/http';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — animated stickers need headroom
});

const router = Router();
router.use(authenticate);

// Packs — static segments must precede the generic /:id routes.
router.post('/packs', validate(createPackDto), withAuth((req, res) => stickerController.createPack(req, res)));
router.patch('/packs/:id', validate(updatePackDto), withAuth((req, res) => stickerController.updatePack(req, res)));
router.delete('/packs/:id', withAuth((req, res) => stickerController.deletePack(req, res)));

router.get('/', withAuth((req, res) => stickerController.list(req, res)));
router.post('/upload', requirePermission('media.upload'), upload.single('file'), withAuth((req, res) => stickerController.upload(req, res)));
router.post('/save', validate(saveStickerDto), withAuth((req, res) => stickerController.save(req, res)));

router.patch('/:id', validate(updateStickerDto), withAuth((req, res) => stickerController.update(req, res)));
router.delete('/:id', withAuth((req, res) => stickerController.remove(req, res)));
router.post('/:id/use', withAuth((req, res) => stickerController.use(req, res)));

export = router;
