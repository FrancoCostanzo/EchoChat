const { Router } = require('express');
const multer = require('multer');
const { userController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { updateProfileDto } = require('../dtos');

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

router.get('/me', (req, res) => userController.getProfile(req, res));
router.put('/me', validate(updateProfileDto), (req, res) => userController.updateProfile(req, res));
router.post('/me/avatar', avatarUpload.single('file'), (req, res) => userController.uploadAvatar(req, res));
router.put('/me/presence', (req, res) => userController.updatePresence(req, res));
router.get('/search', (req, res) => userController.search(req, res));
router.get('/:userId', (req, res) => userController.getUserById(req, res));

module.exports = router;
