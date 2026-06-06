const logger = require('../config/logger');
const {
  messageRepository,
  conversationRepository,
  userRepository,
  auditRepository,
  savedMessageRepository,
  draftRepository,
} = require('../repositories');
const { NotFoundError, ForbiddenError } = require('../errors');
const { toMessageResponse, toSavedMessageResponse, toDraftResponse } = require('../models');
const { minioClient } = require('../config/minio');

// Lazy-load to avoid circular dependency (socket → services → message.service → socket)
function getIO() {
  return require('../socket').getIO();
}

class MessageService {
  async send(userId, data) {
    // Verify membership
    const member = await conversationRepository.getMember(data.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const message = await messageRepository.create({
      ...data,
      sender_id: userId,
    });

    // Add attachments if any
    if (data.attachment_ids && data.attachment_ids.length > 0) {
      for (let i = 0; i < data.attachment_ids.length; i++) {
        await messageRepository.addAttachment(message.id, data.attachment_ids[i], i);
      }
    }

    const full = await messageRepository.findWithAttachments(message.id);
    logger.info({ messageId: message.id, conversationId: data.conversation_id }, 'Message sent');

    const response = toMessageResponse(full);
    try {
      getIO().to(`conv:${data.conversation_id}`).emit('message:new', response);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:new');
    }
    return response;
  }

  async getMessages(conversationId, userId, pagination) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.findByConversation(conversationId, pagination);
    return messages.map(toMessageResponse);
  }

  async getById(messageId) {
    const message = await messageRepository.findWithAttachments(messageId);
    if (!message) throw new NotFoundError('Message');
    return toMessageResponse(message);
  }

  async update(messageId, userId, body) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    if (message.sender_id !== userId) throw new ForbiddenError('Can only edit your own messages');

    const updated = await messageRepository.updateBody(messageId, body, userId);
    logger.info({ messageId }, 'Message edited');

    const response = toMessageResponse(updated);
    try {
      getIO().to(`conv:${message.conversation_id}`).emit('message:edited', response);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:edited');
    }
    return response;
  }

  async delete(messageId, userId) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');

    // Owners delete their own messages; others need the global `messages.delete_any`
    // permission (moderators/admins). This connects per-message ownership with RBAC.
    const isOwner = message.sender_id === userId;
    if (!isOwner) {
      const canDeleteAny = await userRepository.hasPermission(userId, 'messages.delete_any');
      if (!canDeleteAny) throw new ForbiddenError('Can only delete your own messages');
    }

    // Delete attachments from MinIO before soft-deleting the message
    const attachmentObjects = await messageRepository.getAttachmentObjects(messageId);
    for (const obj of attachmentObjects) {
      try {
        await minioClient.removeObject(obj.bucket_name, obj.object_key);
      } catch (err) {
        logger.warn({ err: err.message, objectKey: obj.object_key }, 'Failed to delete object from MinIO');
      }
      if (obj.thumbnail_bucket && obj.thumbnail_key) {
        try {
          await minioClient.removeObject(obj.thumbnail_bucket, obj.thumbnail_key);
        } catch (err) {
          logger.warn({ err: err.message }, 'Failed to delete thumbnail from MinIO');
        }
      }
    }
    if (attachmentObjects.length > 0) {
      await messageRepository.deleteAttachments(messageId);
    }

    const deleted = await messageRepository.softDelete(messageId, userId);
    logger.info({ messageId }, 'Message deleted');

    auditRepository.log({
      actor_id: userId,
      action: 'message.delete',
      resource_type: 'message',
      resource_id: messageId,
      data_before: { conversation_id: message.conversation_id, sender_id: message.sender_id },
      data_after: { by_owner: isOwner },
    }).catch((err) => logger.warn({ err: err.message }, 'Failed to write audit log'));

    const response = toMessageResponse(deleted);
    try {
      getIO().to(`conv:${message.conversation_id}`).emit('message:deleted', response);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:deleted');
    }
    return response;
  }

  async addReaction(messageId, userId, emoji) {
    await messageRepository.toggleReaction(messageId, userId, emoji);
    const reactions = await messageRepository.getReactions(messageId);
    try {
      const message = await messageRepository.findById(messageId);
      getIO().to(`conv:${message.conversation_id}`).emit('message:reaction', {
        messageId,
        reactions,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:reaction');
    }
    return reactions;
  }

  async removeReaction(messageId, userId, emoji) {
    await messageRepository.removeReaction(messageId, userId, emoji);
    const reactions = await messageRepository.getReactions(messageId);
    try {
      const message = await messageRepository.findById(messageId);
      getIO().to(`conv:${message.conversation_id}`).emit('message:reaction', {
        messageId,
        reactions,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:reaction');
    }
    return reactions;
  }

  async addReceipt(messageId, userId, type) {
    const receipt = await messageRepository.addReceipt(messageId, userId, type);
    try {
      const message = await messageRepository.findById(messageId);
      const counts = await messageRepository.getReceiptCounts(messageId);
      getIO().to(`conv:${message.conversation_id}`).emit('message:receipt', {
        messageId,
        conversationId: message.conversation_id,
        delivered_count: parseInt(counts.delivered_count, 10) || 0,
        read_count: parseInt(counts.read_count, 10) || 0,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:receipt');
    }
    return receipt;
  }

  async search(conversationId, userId, term, limit) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.search(conversationId, term, limit);
    return messages.map(toMessageResponse);
  }

  async pinMessage(conversationId, messageId, userId) {
    return messageRepository.pinMessage(conversationId, messageId, userId);
  }

  async unpinMessage(conversationId, messageId) {
    return messageRepository.unpinMessage(conversationId, messageId);
  }

  async getPinnedMessages(conversationId, userId) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.getPinnedMessages(conversationId);
    return messages.map(toMessageResponse);
  }

  // ── Saved messages ────────────────────────────────────────────────────────
  async saveMessage(userId, messageId, note) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    const member = await conversationRepository.getMember(message.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    return savedMessageRepository.save(userId, messageId, note);
  }

  async unsaveMessage(userId, messageId) {
    await savedMessageRepository.unsave(userId, messageId);
  }

  async listSaved(userId, pagination) {
    const rows = await savedMessageRepository.list(userId, pagination);
    return rows.map(toSavedMessageResponse);
  }

  // ── Drafts ──────────────────────────────────────────────────────────────
  async saveDraft(userId, conversationId, data) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const draft = await draftRepository.upsert(userId, conversationId, data);
    return toDraftResponse(draft);
  }

  async getDraft(userId, conversationId) {
    const draft = await draftRepository.get(userId, conversationId);
    return draft ? toDraftResponse(draft) : null;
  }

  async deleteDraft(userId, conversationId) {
    await draftRepository.remove(userId, conversationId);
  }

  async listDrafts(userId) {
    const drafts = await draftRepository.listByUser(userId);
    return drafts.map(toDraftResponse);
  }
}

module.exports = new MessageService();
