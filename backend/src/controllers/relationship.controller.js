const { StatusCodes } = require('http-status-codes');
const { relationshipService } = require('../services');

class RelationshipController {
  async create(req, res) {
    const rel = await relationshipService.create(req.user.id, req.body);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: rel });
  }

  async remove(req, res) {
    await relationshipService.remove(req.user.id, req.params.targetId, req.params.type);
    res.json({ status: 'success', message: 'Relationship removed' });
  }

  async getContacts(req, res) {
    const contacts = await relationshipService.getByUser(req.user.id, 'contact');
    res.json({ status: 'success', data: contacts });
  }

  async getBlocked(req, res) {
    const blocked = await relationshipService.getByUser(req.user.id, 'blocked');
    res.json({ status: 'success', data: blocked });
  }

  async getFavorites(req, res) {
    const favorites = await relationshipService.getByUser(req.user.id, 'favorite');
    res.json({ status: 'success', data: favorites });
  }
}

module.exports = new RelationshipController();
