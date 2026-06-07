const { Router } = require('express');
const { pollController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { createPollDto, voteDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(createPollDto), (req, res) => pollController.create(req, res));
router.post('/:pollId/vote', validate(voteDto), (req, res) => pollController.vote(req, res));
router.delete('/:pollId/vote', (req, res) => pollController.retract(req, res));
router.post('/:pollId/close', (req, res) => pollController.close(req, res));

module.exports = router;
