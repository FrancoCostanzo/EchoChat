const { StatusCodes } = require('http-status-codes');
const { gameService } = require('../services');

class GameController {
  async create(req, res) {
    const message = await gameService.createGame(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async move(req, res) {
    const game = await gameService.move(req.user.id, req.params.gameId, req.body);
    res.json({ status: 'success', data: game });
  }
}

module.exports = new GameController();
