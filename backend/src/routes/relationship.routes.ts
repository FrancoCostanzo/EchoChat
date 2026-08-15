import { Router } from 'express';
import { relationshipController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { relationshipDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(relationshipDto), withAuth((req, res) => relationshipController.create(req, res)));
router.delete('/:targetId/:type', withAuth((req, res) => relationshipController.remove(req, res)));
router.get('/contacts', withAuth((req, res) => relationshipController.getContacts(req, res)));
router.get('/blocked', withAuth((req, res) => relationshipController.getBlocked(req, res)));
router.get('/favorites', withAuth((req, res) => relationshipController.getFavorites(req, res)));

export default router;
