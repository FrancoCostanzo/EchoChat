import { Router } from 'express';
import { channelController } from '../controllers';
import { validate, authenticate, requirePermission } from '../middlewares';
import { createChannelDto, updateChannelSettingsDto, joinChannelDto, reviewJoinRequestDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

// Discovery
router.get('/discover', withAuth((req, res) => channelController.discover(req, res)));

// Create (requires global permission to create groups/channels)
router.post('/', requirePermission('groups.create'), validate(createChannelDto), withAuth((req, res) => channelController.create(req, res)));

// Single channel
router.get('/:conversationId', withAuth((req, res) => channelController.getById(req, res)));
router.put('/:conversationId/settings', validate(updateChannelSettingsDto), withAuth((req, res) => channelController.updateSettings(req, res)));

// Join / request access
router.post('/:conversationId/join', validate(joinChannelDto), withAuth((req, res) => channelController.join(req, res)));

// Join request moderation
router.get('/:conversationId/requests', withAuth((req, res) => channelController.listRequests(req, res)));
router.put('/:conversationId/requests/:requestId', validate(reviewJoinRequestDto), withAuth((req, res) => channelController.reviewRequest(req, res)));

export default router;
