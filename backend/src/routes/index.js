const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/conversations', require('./conversation.routes'));
router.use('/channels', require('./channel.routes'));
router.use('/messages', require('./message.routes'));
router.use('/calls', require('./call.routes'));
router.use('/storage', require('./storage.routes'));
router.use('/broadcasts', require('./broadcast.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/relationships', require('./relationship.routes'));

module.exports = router;
