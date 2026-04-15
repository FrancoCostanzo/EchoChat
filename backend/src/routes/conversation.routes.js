const { Router } = require('express');
const { conversationController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { createConversationDto, updateConversationDto, addMembersDto, updateMemberDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(createConversationDto), (req, res) => conversationController.create(req, res));
router.get('/', (req, res) => conversationController.getUserConversations(req, res));
router.get('/:conversationId', (req, res) => conversationController.getById(req, res));
router.put('/:conversationId', validate(updateConversationDto), (req, res) => conversationController.update(req, res));

// Members
router.get('/:conversationId/members', (req, res) => conversationController.getMembers(req, res));
router.post('/:conversationId/members', validate(addMembersDto), (req, res) => conversationController.addMembers(req, res));
router.put('/:conversationId/members/:userId', validate(updateMemberDto), (req, res) => conversationController.updateMember(req, res));
router.delete('/:conversationId/members/:userId', (req, res) => conversationController.removeMember(req, res));

// Read status
router.post('/:conversationId/read', (req, res) => conversationController.markAsRead(req, res));

module.exports = router;
