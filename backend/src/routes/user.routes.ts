import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { updateProfileDto } from '../dtos';
import { withAuth } from '../types/http';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

router.get('/me', withAuth((req, res) => userController.getProfile(req, res)));
router.put('/me', validate(updateProfileDto), withAuth((req, res) => userController.updateProfile(req, res)));
router.post('/me/avatar', avatarUpload.single('file'), withAuth((req, res) => userController.uploadAvatar(req, res)));
router.put('/me/presence', withAuth((req, res) => userController.updatePresence(req, res)));
router.get('/search', withAuth((req, res) => userController.search(req, res)));
router.get('/:userId', withAuth((req, res) => userController.getUserById(req, res)));

export = router;
