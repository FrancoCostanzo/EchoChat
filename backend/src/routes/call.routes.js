const { Router } = require('express');
const { callController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { initiateCallDto, updateCallStatusDto, updateParticipantDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(initiateCallDto), (req, res) => callController.initiate(req, res));
router.get('/active', (req, res) => callController.getActive(req, res));
router.get('/conversation/:conversationId', (req, res) => callController.getByConversation(req, res));
router.get('/:callId', (req, res) => callController.getById(req, res));
router.put('/:callId/status', validate(updateCallStatusDto), (req, res) => callController.updateStatus(req, res));
router.put('/:callId/participants/:userId', validate(updateParticipantDto), (req, res) => callController.updateParticipant(req, res));

module.exports = router;
