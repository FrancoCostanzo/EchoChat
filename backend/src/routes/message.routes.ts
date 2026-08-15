import { Router } from 'express';
import { messageController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { sendMessageDto, updateMessageDto, reactionDto, saveMessageDto, draftDto, forwardDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.post('/', validate(sendMessageDto), withAuth((req, res) => messageController.send(req, res)));

// Saved messages & drafts — literal paths must precede '/:messageId'
router.get('/saved', withAuth((req, res) => messageController.listSaved(req, res)));
router.get('/drafts', withAuth((req, res) => messageController.listDrafts(req, res)));

router.get('/:messageId', withAuth((req, res) => messageController.getById(req, res)));
router.get('/:messageId/thread', withAuth((req, res) => messageController.getThread(req, res)));
router.get('/:messageId/info', withAuth((req, res) => messageController.getInfo(req, res)));
router.put('/:messageId', validate(updateMessageDto), withAuth((req, res) => messageController.update(req, res)));
router.delete('/:messageId', withAuth((req, res) => messageController.delete(req, res)));

// Reactions
router.post('/:messageId/reactions', validate(reactionDto), withAuth((req, res) => messageController.addReaction(req, res)));
router.delete('/:messageId/reactions/:emoji', withAuth((req, res) => messageController.removeReaction(req, res)));

// Receipts
router.post('/:messageId/receipts', withAuth((req, res) => messageController.addReceipt(req, res)));

// Save / unsave a message
router.post('/:messageId/save', validate(saveMessageDto), withAuth((req, res) => messageController.save(req, res)));
router.delete('/:messageId/save', withAuth((req, res) => messageController.unsave(req, res)));

// Forward a message to other conversations
router.post('/:messageId/forward', validate(forwardDto), withAuth((req, res) => messageController.forward(req, res)));

// Conversation context routes
router.get('/conversation/:conversationId', withAuth((req, res) => messageController.getMessages(req, res)));
router.get('/conversation/:conversationId/search', withAuth((req, res) => messageController.search(req, res)));
router.get('/conversation/:conversationId/pinned', withAuth((req, res) => messageController.getPinned(req, res)));
router.post('/conversation/:conversationId/pin/:messageId', withAuth((req, res) => messageController.pin(req, res)));
router.delete('/conversation/:conversationId/pin/:messageId', withAuth((req, res) => messageController.unpin(req, res)));

// Drafts (per conversation)
router.get('/conversation/:conversationId/draft', withAuth((req, res) => messageController.getDraft(req, res)));
router.put('/conversation/:conversationId/draft', validate(draftDto), withAuth((req, res) => messageController.saveDraft(req, res)));
router.delete('/conversation/:conversationId/draft', withAuth((req, res) => messageController.deleteDraft(req, res)));

export = router;
