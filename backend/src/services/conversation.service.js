const logger = require('../config/logger');
const { conversationRepository, auditRepository } = require('../repositories');
const { minioClient } = require('../config/minio');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../errors');
const { toConversationResponse, toMemberResponse } = require('../models');

const AVATAR_BUCKET = 'messaging-avatars';

async function enrichAvatarUrl(conv) {
  if (!conv || !conv.other_avatar_object_key) return conv;
  try {
    const url = await minioClient.presignedGetObject(AVATAR_BUCKET, conv.other_avatar_object_key, 60 * 60 * 24);
    return { ...conv, other_avatar_url: url };
  } catch (err) {
    logger.warn({ err }, 'Failed to generate other_avatar presigned URL');
    return conv;
  }
}

class ConversationService {
  async create(userId, data) {
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

  async getById(conversationId, userId) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation');
    return enrichAvatarUrl(toConversationResponse(conversation));
  }

  async getUserConversations(userId, pagination) {
    const conversations = await conversationRepository.findUserConversations(userId, pagination);
    return Promise.all(conversations.map(toConversationResponse).map(enrichAvatarUrl));
  }

  async update(conversationId, userId, data) {
    await this._requireRole(conversationId, userId, ['owner', 'admin']);
    const conversation = await conversationRepository.update(conversationId, data);
    if (!conversation) throw new NotFoundError('Conversation');
    logger.info({ conversationId }, 'Conversation updated');
    return toConversationResponse(conversation);
  }

  async addMembers(conversationId, userId, memberIds) {
    await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    const results = [];
    for (const memberId of memberIds) {
      const member = await conversationRepository.addMember(conversationId, memberId, 'member', userId);
      results.push(toMemberResponse(member));
    }
    logger.info({ conversationId, added: memberIds.length }, 'Members added');
    return results;
  }

  async removeMember(conversationId, userId, targetUserId) {
    // Users can remove themselves; admins can remove others
    if (userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    }
    const member = await conversationRepository.removeMember(conversationId, targetUserId);
    if (!member) throw new NotFoundError('Member');
    logger.info({ conversationId, removedUser: targetUserId }, 'Member removed');
    return member;
  }

  async getMembers(conversationId, userId, pagination) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const members = await conversationRepository.getMembers(conversationId, pagination);
    return members.map(toMemberResponse);
  }

  async updateMember(conversationId, userId, targetUserId, data) {
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
      }).catch((err) => logger.warn({ err: err.message }, 'Failed to write audit log'));
    }
    return toMemberResponse(member);
  }

  async markAsRead(conversationId, userId, messageId) {
    return conversationRepository.markAsRead(conversationId, userId, messageId);
  }

  async _requireRole(conversationId, userId, allowedRoles) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenError('Insufficient role for this action');
    }
    return member;
  }
}

module.exports = new ConversationService();
