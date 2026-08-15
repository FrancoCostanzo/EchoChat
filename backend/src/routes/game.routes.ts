import { Router } from 'express';
import { gameController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { createGameDto, gameMoveDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(createGameDto), withAuth((req, res) => gameController.create(req, res)));
router.post('/:gameId/move', validate(gameMoveDto), withAuth((req, res) => gameController.move(req, res)));

export = router;
