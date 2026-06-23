const { Router } = require('express');
const { channelController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const { createChannelDto, updateChannelSettingsDto, joinChannelDto, reviewJoinRequestDto } = require('../dtos');

const router = Router();
router.use(authenticate);

// Discovery
router.get('/discover', (req, res) => channelController.discover(req, res));

// Create (requires global permission to create groups/channels)
router.post('/', requirePermission('groups.create'), validate(createChannelDto), (req, res) => channelController.create(req, res));

// Single channel
router.get('/:conversationId', (req, res) => channelController.getById(req, res));
router.put('/:conversationId/settings', validate(updateChannelSettingsDto), (req, res) => channelController.updateSettings(req, res));

// Join / request access
router.post('/:conversationId/join', validate(joinChannelDto), (req, res) => channelController.join(req, res));

// Join request moderation
router.get('/:conversationId/requests', (req, res) => channelController.listRequests(req, res));
router.put('/:conversationId/requests/:requestId', validate(reviewJoinRequestDto), (req, res) => channelController.reviewRequest(req, res));

module.exports = router;
