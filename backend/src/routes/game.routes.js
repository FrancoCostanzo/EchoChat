const { Router } = require('express');
const { gameController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { createGameDto, gameMoveDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(createGameDto), (req, res) => gameController.create(req, res));
router.post('/:gameId/move', validate(gameMoveDto), (req, res) => gameController.move(req, res));

module.exports = router;
