import { Router } from 'express';
import { pollController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { createPollDto, voteDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(createPollDto), withAuth((req, res) => pollController.create(req, res)));
router.post('/:pollId/vote', validate(voteDto), withAuth((req, res) => pollController.vote(req, res)));
router.delete('/:pollId/vote', withAuth((req, res) => pollController.retract(req, res)));
router.post('/:pollId/close', withAuth((req, res) => pollController.close(req, res)));

export default router;
