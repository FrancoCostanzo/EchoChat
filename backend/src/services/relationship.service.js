const { relationshipRepository } = require('../repositories');
const { BadRequestError } = require('../errors');

class RelationshipService {
  async create(userId, data) {
    if (userId === data.target_user_id) {
      throw new BadRequestError('Cannot create a relationship with yourself');
    }
    return relationshipRepository.create({ user_id: userId, ...data });
  }

  async remove(userId, targetUserId, type) {
    return relationshipRepository.remove(userId, targetUserId, type);
  }

  async getByUser(userId, type) {
    return relationshipRepository.findByUser(userId, type);
  }

  async isBlocked(userId, targetUserId) {
    return relationshipRepository.isBlocked(userId, targetUserId);
  }
}

module.exports = new RelationshipService();
