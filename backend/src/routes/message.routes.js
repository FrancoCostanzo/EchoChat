const { Router } = require('express');
const { messageController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { sendMessageDto, updateMessageDto, reactionDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(sendMessageDto), (req, res) => messageController.send(req, res));
router.get('/:messageId', (req, res) => messageController.getById(req, res));
router.put('/:messageId', validate(updateMessageDto), (req, res) => messageController.update(req, res));
router.delete('/:messageId', (req, res) => messageController.delete(req, res));

// Reactions
router.post('/:messageId/reactions', validate(reactionDto), (req, res) => messageController.addReaction(req, res));
router.delete('/:messageId/reactions/:emoji', (req, res) => messageController.removeReaction(req, res));

// Receipts
router.post('/:messageId/receipts', (req, res) => messageController.addReceipt(req, res));

// Conversation context routes
router.get('/conversation/:conversationId', (req, res) => messageController.getMessages(req, res));
router.get('/conversation/:conversationId/search', (req, res) => messageController.search(req, res));
router.get('/conversation/:conversationId/pinned', (req, res) => messageController.getPinned(req, res));
router.post('/conversation/:conversationId/pin/:messageId', (req, res) => messageController.pin(req, res));
router.delete('/conversation/:conversationId/pin/:messageId', (req, res) => messageController.unpin(req, res));

module.exports = router;
