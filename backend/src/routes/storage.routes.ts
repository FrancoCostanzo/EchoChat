import { Router } from 'express';
import multer from 'multer';
import { storageController } from '../controllers';
import { validate, authenticate, requirePermission } from '../middlewares';
import { uploadMetadataDto } from '../dtos';
import { withAuth } from '../types/http';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

const router = Router();
router.use(authenticate);

router.post('/upload', requirePermission('media.upload'), upload.single('file'), withAuth((req, res) => storageController.upload(req, res)));
router.post('/upload-url', requirePermission('media.upload'), validate(uploadMetadataDto), withAuth((req, res) => storageController.getUploadUrl(req, res)));

router.get('/:objectId', withAuth((req, res) => storageController.getById(req, res)));
router.get('/:objectId/url', withAuth((req, res) => storageController.getPresignedUrl(req, res)));
router.delete('/:objectId', withAuth((req, res) => storageController.delete(req, res)));

export = router;
