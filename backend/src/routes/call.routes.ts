import { Router } from 'express';
import { callController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { initiateCallDto, updateCallStatusDto, updateParticipantDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(initiateCallDto), withAuth((req, res) => callController.initiate(req, res)));
router.get('/active', withAuth((req, res) => callController.getActive(req, res)));
router.get('/history', withAuth((req, res) => callController.getHistory(req, res)));
router.get('/conversation/:conversationId', withAuth((req, res) => callController.getByConversation(req, res)));
router.get('/:callId', withAuth((req, res) => callController.getById(req, res)));
router.put('/:callId/status', validate(updateCallStatusDto), withAuth((req, res) => callController.updateStatus(req, res)));
router.put('/:callId/participants/:userId', validate(updateParticipantDto), withAuth((req, res) => callController.updateParticipant(req, res)));

export default router;
