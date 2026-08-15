import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { gameService } from '../services';
import type { AuthRequest } from '../types/http';

class GameController {
  async create(req: AuthRequest, res: Response) {
    const message = await gameService.createGame(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async move(req: AuthRequest, res: Response) {
    const game = await gameService.move(req.user.id, req.params.gameId, req.body);
    res.json({ status: 'success', data: game });
  }
}

export default new GameController();
