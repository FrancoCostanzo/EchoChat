import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { relationshipService } from '../services';
import type { AuthRequest } from '../types/http';

class RelationshipController {
  async create(req: AuthRequest, res: Response) {
    const rel = await relationshipService.create(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: rel });
  }

  async remove(req: AuthRequest, res: Response) {
    await relationshipService.remove(req.user.id, req.params.targetId, req.params.type);
    res.json({ status: 'success', message: 'Relationship removed' });
  }

  async getContacts(req: AuthRequest, res: Response) {
    const contacts = await relationshipService.getByUser(req.user.id, 'contact');
    res.json({ status: 'success', data: contacts });
  }

  async getBlocked(req: AuthRequest, res: Response) {
    const blocked = await relationshipService.getByUser(req.user.id, 'blocked');
    res.json({ status: 'success', data: blocked });
  }

  async getFavorites(req: AuthRequest, res: Response) {
    const favorites = await relationshipService.getByUser(req.user.id, 'favorite');
    res.json({ status: 'success', data: favorites });
  }
}

export = new RelationshipController();
