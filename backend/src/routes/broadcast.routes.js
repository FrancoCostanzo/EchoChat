const { Router } = require('express');
const { broadcastController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const { createBroadcastListDto, sendBroadcastDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('broadcast.create'), validate(createBroadcastListDto), (req, res) => broadcastController.createList(req, res));
router.get('/', (req, res) => broadcastController.getLists(req, res));
router.get('/:listId', (req, res) => broadcastController.getListById(req, res));
router.post('/:listId/messages', requirePermission('broadcast.send'), validate(sendBroadcastDto), (req, res) => broadcastController.sendMessage(req, res));

module.exports = router;
