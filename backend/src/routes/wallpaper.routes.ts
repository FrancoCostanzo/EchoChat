import { Router } from 'express';
import { wallpaperController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { upsertWallpaperDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.get('/', withAuth((req, res) => wallpaperController.getAll(req, res)));
router.put('/', validate(upsertWallpaperDto), withAuth((req, res) => wallpaperController.upsert(req, res)));
router.delete('/:scope/:scope_key', withAuth((req, res) => wallpaperController.remove(req, res)));

export = router;
