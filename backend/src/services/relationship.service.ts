import { relationshipRepository } from '../repositories';
import { publicMinioClient } from '../config/minio';
import { BadRequestError } from '../errors';
import logger from '../config/logger';
import type { RelationshipWithUser } from '../repositories/relationship.repository';
import type { RelationshipRequest } from '../dtos/relationship.dto';

const AVATAR_BUCKET = 'messaging-avatars';

/** La URL prefirmada se resuelve acá: el repositorio sólo trae las claves. */
async function withAvatarUrl(row: RelationshipWithUser) {
  if (!row?.avatar_object_key) return row;
  try {
    const url = await publicMinioClient.presignedGetObject(
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
  async create(userId: string, data: RelationshipRequest) {
    if (userId === data.target_user_id) {
      throw new BadRequestError('Cannot create a relationship with yourself');
    }
    return relationshipRepository.create({ user_id: userId, ...data });
  }

  async remove(userId: string, targetUserId: string, type: string) {
    return relationshipRepository.remove(userId, targetUserId, type);
  }

  async getByUser(userId: string, type: string | null) {
    const rows = await relationshipRepository.findByUser(userId, type);
    return Promise.all(rows.map(withAvatarUrl));
  }

  async isBlocked(userId: string, targetUserId: string) {
    return relationshipRepository.isBlocked(userId, targetUserId);
  }
}

export default new RelationshipService();
