import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { userService } from '../services';
import { qInt, qStr, type AuthRequest } from '../types/http';

class UserController {
  async getProfile(req: AuthRequest, res: Response) {
    const user = await userService.getProfile(req.user.id);
    res.json({ status: 'success', data: user });
  }

  async updateProfile(req: AuthRequest, res: Response) {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json({ status: 'success', data: user });
  }

  async uploadAvatar(req: AuthRequest, res: Response) {
    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({ status: 'error', message: 'No file provided' });
    }
    const user = await userService.uploadAvatar(
      req.user.id,
      req.file.buffer,
      req.file.mimetype,
      req.file.size,
      req.file.originalname,
    );
    res.json({ status: 'success', data: user });
  }

  async updatePresence(req: AuthRequest, res: Response) {
    const user = await userService.updatePresence(req.user.id, req.body.presence);
    res.json({ status: 'success', data: user });
  }

  async setAway(req: AuthRequest, res: Response) {
    const user = await userService.setAway(req.user.id, req.body);
    res.json({ status: 'success', data: user });
  }

  async clearAway(req: AuthRequest, res: Response) {
    const user = await userService.clearAway(req.user.id);
    res.json({ status: 'success', data: user });
  }

  async search(req: AuthRequest, res: Response) {
    const { q, limit, offset } = req.query;
    const users = await userService.search(qStr(q), qInt(limit, 20), qInt(offset, 0));
    res.json({ status: 'success', data: users });
  }

  async getUserById(req: AuthRequest, res: Response) {
    const user = await userService.getUserById(req.params.userId);
    res.json({ status: 'success', data: user });
  }
}

export default new UserController();
