const { Router } = require('express');
const { broadcastController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const { createBroadcastListDto, sendBroadcastDto, addBroadcastRecipientsDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('broadcast.create'), validate(createBroadcastListDto), (req, res) => broadcastController.createList(req, res));
router.get('/', (req, res) => broadcastController.getLists(req, res));
router.get('/:listId', (req, res) => broadcastController.getListById(req, res));
router.get('/:listId/messages', (req, res) => broadcastController.getMessages(req, res));
router.get('/:listId/messages/:messageId/deliveries', (req, res) => broadcastController.getDeliveries(req, res));
router.post('/:listId/recipients', requirePermission('broadcast.create'), validate(addBroadcastRecipientsDto), (req, res) => broadcastController.addRecipients(req, res));
router.delete('/:listId/recipients/:userId', requirePermission('broadcast.create'), (req, res) => broadcastController.removeRecipient(req, res));
router.post('/:listId/messages', requirePermission('broadcast.send'), validate(sendBroadcastDto), (req, res) => broadcastController.sendMessage(req, res));

module.exports = router;
