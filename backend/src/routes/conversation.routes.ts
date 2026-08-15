import { Router } from 'express';
import { conversationController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { createConversationDto, updateConversationDto, addMembersDto, updateMemberDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(createConversationDto), withAuth((req, res) => conversationController.create(req, res)));
router.get('/', withAuth((req, res) => conversationController.getUserConversations(req, res)));
router.get('/:conversationId', withAuth((req, res) => conversationController.getById(req, res)));
router.put('/:conversationId', validate(updateConversationDto), withAuth((req, res) => conversationController.update(req, res)));

// Members
router.get('/:conversationId/members', withAuth((req, res) => conversationController.getMembers(req, res)));
router.post('/:conversationId/members', validate(addMembersDto), withAuth((req, res) => conversationController.addMembers(req, res)));
router.put('/:conversationId/members/:userId', validate(updateMemberDto), withAuth((req, res) => conversationController.updateMember(req, res)));
router.delete('/:conversationId/members/:userId', withAuth((req, res) => conversationController.removeMember(req, res)));

// Read status
router.post('/:conversationId/read', withAuth((req, res) => conversationController.markAsRead(req, res)));

export = router;
