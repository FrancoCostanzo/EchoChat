const { relationshipRepository } = require('../repositories');
const { minioClient } = require('../config/minio');
const { BadRequestError } = require('../errors');
const logger = require('../config/logger');

const AVATAR_BUCKET = 'messaging-avatars';

async function withAvatarUrl(row) {
  if (!row?.avatar_object_key) return row;
  try {
    const url = await minioClient.presignedGetObject(
      row.avatar_bucket || AVATAR_BUCKET,
      row.avatar_object_key,
      60 * 60 * 24,
    );
    return { ...row, avatar_url: url };
  } catch (err) {
    logger.warn({ err, userId: row.target_user_id }, 'Failed to generate relationship avatar URL');
    return row;
  }
}

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
    const rows = await relationshipRepository.findByUser(userId, type);
    return Promise.all(rows.map(withAvatarUrl));
  }

  async isBlocked(userId, targetUserId) {
    return relationshipRepository.isBlocked(userId, targetUserId);
  }
}

module.exports = new RelationshipService();
