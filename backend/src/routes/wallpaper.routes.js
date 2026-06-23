const { Router } = require('express');
const { wallpaperController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { upsertWallpaperDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => wallpaperController.getAll(req, res));
router.put('/', validate(upsertWallpaperDto), (req, res) => wallpaperController.upsert(req, res));
router.delete('/:scope/:scope_key', (req, res) => wallpaperController.remove(req, res));

module.exports = router;
