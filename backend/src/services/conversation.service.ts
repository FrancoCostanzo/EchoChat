import logger from '../config/logger';
import { conversationRepository, auditRepository } from '../repositories';
import { minioClient } from '../config/minio';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toConversationResponse, toMemberResponse } from '../models';
import type { ConversationResponse, MemberResponse } from '../models/conversation.model';
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  UpdateMemberRequest,
} from '../dtos/conversation.dto';

const AVATAR_BUCKET = 'messaging-avatars';

/** Las URLs prefirmadas se resuelven acá: el repositorio sólo trae las claves. */
async function enrichAvatarUrl(conv: ConversationResponse | null) {
  if (!conv || !conv.other_avatar_object_key) return conv;
  try {
    const url = await minioClient.presignedGetObject(AVATAR_BUCKET, conv.other_avatar_object_key, 60 * 60 * 24);
    return { ...conv, other_avatar_url: url };
  } catch (err) {
    logger.warn({ err }, 'Failed to generate other_avatar presigned URL');
    return conv;
  }
}

async function enrichMemberAvatarUrl(member: MemberResponse | null) {
  if (!member || !member.avatar_object_key) return member;
  try {
    const url = await minioClient.presignedGetObject(AVATAR_BUCKET, member.avatar_object_key, 60 * 60 * 24);
    return { ...member, avatar_url: url };
  } catch (err) {
    logger.warn({ err, userId: member.user_id }, 'Failed to generate member avatar presigned URL');
    return member;
  }
}

class ConversationService {
  async create(userId: string, data: CreateConversationRequest) {
    // For direct chats, check if one already exists
    if (data.type === 'direct') {
      if (data.member_ids.length !== 1) {
        throw new BadRequestError('Direct conversations require exactly one other member');
      }
      const existing = await conversationRepository.findDirectBetween(userId, data.member_ids[0]);
      if (existing) return enrichAvatarUrl(toConversationResponse(existing));
    }

    const conversation = await conversationRepository.create({
      ...data,
      created_by: userId,
    });

    // Add creator as owner
    await conversationRepository.addMember(conversation.id, userId, 'owner');

    // Add other members
    for (const memberId of data.member_ids) {
      if (memberId !== userId) {
        await conversationRepository.addMember(conversation.id, memberId, 'member', userId);
      }
    }

    logger.info({ conversationId: conversation.id, type: data.type }, 'Conversation created');
    return enrichAvatarUrl(toConversationResponse(conversation));
  }

  async getById(conversationId: string, userId: string) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation');
    return enrichAvatarUrl(toConversationResponse(conversation));
  }

  async getUserConversations(userId: string, pagination?: { limit?: number; offset?: number }) {
    const conversations = await conversationRepository.findUserConversations(userId, pagination);
    return Promise.all(conversations.map(toConversationResponse).map(enrichAvatarUrl));
  }

  async update(conversationId: string, userId: string, data: UpdateConversationRequest) {
    await this._requireRole(conversationId, userId, ['owner', 'admin']);
    const conversation = await conversationRepository.update(conversationId, data);
    if (!conversation) throw new NotFoundError('Conversation');
    logger.info({ conversationId }, 'Conversation updated');
    return toConversationResponse(conversation);
  }

  async addMembers(conversationId: string, userId: string, memberIds: string[]) {
    await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    const results = [];
    for (const memberId of memberIds) {
      const member = await conversationRepository.addMember(conversationId, memberId, 'member', userId);
      results.push(toMemberResponse(member));
    }
    logger.info({ conversationId, added: memberIds.length }, 'Members added');
    return results;
  }

  async removeMember(conversationId: string, userId: string, targetUserId: string) {
    // Users can remove themselves; admins can remove others
    if (userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    }
    const member = await conversationRepository.removeMember(conversationId, targetUserId);
    if (!member) throw new NotFoundError('Member');
    logger.info({ conversationId, removedUser: targetUserId }, 'Member removed');
    return member;
  }

  async getMembers(
    conversationId: string,
    userId: string,
    pagination?: { limit?: number; offset?: number },
  ) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const members = await conversationRepository.getMembers(conversationId, pagination);
    return Promise.all(members.map(toMemberResponse).map(enrichMemberAvatarUrl));
  }

  async updateMember(
    conversationId: string,
    userId: string,
    targetUserId: string,
    data: UpdateMemberRequest,
  ) {
    // Users can update their own settings (mute, pin, hide); role changes need admin
    if (data.role && userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin']);
    } else if (userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    }
    const member = await conversationRepository.updateMember(conversationId, targetUserId, data);
    if (!member) throw new NotFoundError('Member');

    // Audit role changes (privilege escalation/demotion is security-relevant)
    if (data.role) {
      auditRepository.log({
        actor_id: userId,
        action: 'conversation.member_role_change',
        resource_type: 'conversation',
        resource_id: conversationId,
        severity: 'warning',
        category: 'content',
        data_after: { target_user_id: targetUserId, new_role: data.role },
      }).catch((err: Error) => logger.warn({ err: err.message }, 'Failed to write audit log'));
    }
    return toMemberResponse(member);
  }

  async markAsRead(conversationId: string, userId: string, messageId: string) {
    return conversationRepository.markAsRead(conversationId, userId, messageId);
  }

  async _requireRole(conversationId: string, userId: string, allowedRoles: string[]) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    if (!allowedRoles.includes(member.role as string)) {
      throw new ForbiddenError('Insufficient role for this action');
    }
    return member;
  }
}

export = new ConversationService();
