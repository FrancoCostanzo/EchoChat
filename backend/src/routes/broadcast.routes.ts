import { Router } from 'express';
import { broadcastController } from '../controllers';
import { validate, authenticate, requirePermission } from '../middlewares';
import { createBroadcastListDto, sendBroadcastDto, addBroadcastRecipientsDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('broadcast.create'), validate(createBroadcastListDto), withAuth((req, res) => broadcastController.createList(req, res)));
router.get('/', withAuth((req, res) => broadcastController.getLists(req, res)));
router.get('/:listId', withAuth((req, res) => broadcastController.getListById(req, res)));
router.get('/:listId/messages', withAuth((req, res) => broadcastController.getMessages(req, res)));
router.get('/:listId/messages/:messageId/deliveries', withAuth((req, res) => broadcastController.getDeliveries(req, res)));
router.post('/:listId/recipients', requirePermission('broadcast.create'), validate(addBroadcastRecipientsDto), withAuth((req, res) => broadcastController.addRecipients(req, res)));
router.delete('/:listId/recipients/:userId', requirePermission('broadcast.create'), withAuth((req, res) => broadcastController.removeRecipient(req, res)));
router.post('/:listId/messages', requirePermission('broadcast.send'), validate(sendBroadcastDto), withAuth((req, res) => broadcastController.sendMessage(req, res)));

export default router;
