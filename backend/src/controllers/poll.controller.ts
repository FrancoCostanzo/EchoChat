import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { pollService } from '../services';
import type { AuthRequest } from '../types/http';

class PollController {
  async create(req: AuthRequest, res: Response) {
    const message = await pollService.createPoll(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: message });
  }

  async vote(req: AuthRequest, res: Response) {
    const poll = await pollService.vote(req.user.id, req.params.pollId, req.body.option_ids);
    res.json({ status: 'success', data: poll });
  }

  async retract(req: AuthRequest, res: Response) {
    const poll = await pollService.retractVote(req.user.id, req.params.pollId);
    res.json({ status: 'success', data: poll });
  }

  async close(req: AuthRequest, res: Response) {
    const poll = await pollService.close(req.user.id, req.params.pollId);
    res.json({ status: 'success', data: poll });
  }
}

export default new PollController();
