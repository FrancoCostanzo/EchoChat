const logger = require('../config/logger');
const {
  messageRepository,
  conversationRepository,
  userRepository,
  auditRepository,
  savedMessageRepository,
  draftRepository,
  pollRepository,
} = require('../repositories');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../errors');
const { toMessageResponse, toSavedMessageResponse, toDraftResponse, toPollResponse } = require('../models');
const { resolveBodyFormat } = require('../utils/markdown.util');
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

    // Thread replies must point at a root message of the same conversation.
    // Replying to a reply gets flattened onto the original root (Slack-style).
    if (data.thread_id) {
      const root = await messageRepository.findById(data.thread_id);
      if (!root || root.conversation_id !== data.conversation_id) {
        throw new BadRequestError('Invalid thread root');
      }
      if (root.thread_id) data.thread_id = root.thread_id;
    }

    const message = await messageRepository.create({
      ...data,
      sender_id: userId,
      body_format: resolveBodyFormat(data.body, data.body_format),
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
      // Let open timelines refresh the root's reply counter without refetching
      if (response.thread_id) {
        const threadCount = await messageRepository.countThreadReplies(response.thread_id);
        getIO().to(`conv:${data.conversation_id}`).emit('message:thread_count', {
          messageId: response.thread_id,
          thread_count: threadCount,
        });
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:new');
    }
    return response;
  }

  // Root message + ordered replies for the thread side panel
  async getThread(messageId, userId) {
    const root = await messageRepository.findWithAttachments(messageId, userId);
    if (!root) throw new NotFoundError('Message');
    const member = await conversationRepository.getMember(root.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const replies = await messageRepository.findThreadReplies(messageId, { viewerUserId: userId });
    const rootResponse = toMessageResponse(root);
    const replyResponses = replies.map(toMessageResponse);
    await this._attachPolls([rootResponse, ...replyResponses], userId);
    return { root: rootResponse, replies: replyResponses };
  }

  async getMessages(conversationId, userId, pagination) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.findByConversation(conversationId, {
      ...pagination,
      viewerUserId: userId,
    });
    const responses = messages.map(toMessageResponse);
    await this._attachPolls(responses, userId);
    return responses;
  }

  // Attach poll data (options + the user's votes) to any 'poll' type messages.
  async _attachPolls(responses, userId) {
    for (const m of responses) {
      if (m.type !== 'poll') continue;
      const poll = await pollRepository.findByMessageId(m.id);
      if (!poll) continue;
      const options = await pollRepository.getOptions(poll.id);
      const myVotes = await pollRepository.getUserVotes(poll.id, userId);
      m.poll = toPollResponse(poll, options, myVotes);
    }
    return responses;
  }

  async getById(messageId) {
    const message = await messageRepository.findWithAttachments(messageId);
    if (!message) throw new NotFoundError('Message');
    return toMessageResponse(message);
  }

  async update(messageId, userId, body, bodyFormat) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    if (message.sender_id !== userId) throw new ForbiddenError('Can only edit your own messages');

    const format = resolveBodyFormat(body, bodyFormat);
    const updated = await messageRepository.updateBody(messageId, body, userId, format);
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

  // ── Forwarding ────────────────────────────────────────────────────────────
  async forward(userId, messageId, conversationIds) {
    const source = await messageRepository.findById(messageId);
    if (!source) throw new NotFoundError('Message');
    const srcMember = await conversationRepository.getMember(source.conversation_id, userId);
    if (!srcMember) throw new ForbiddenError('Not a member of the source conversation');

    const objectIds = await messageRepository.getAttachmentObjectIds(messageId);
    const results = [];

    for (const convId of conversationIds) {
      const member = await conversationRepository.getMember(convId, userId);
      if (!member) continue; // silently skip conversations the user isn't part of

      const created = await messageRepository.create({
        conversation_id: convId,
        sender_id: userId,
        type: objectIds.length ? 'media' : 'text',
        body: source.body,
        forwarded_from_id: source.id,
        forwarded_from_conv: source.conversation_id,
      });

      // Forwarded copies reference the same storage objects (no re-upload).
      for (let i = 0; i < objectIds.length; i++) {
        await messageRepository.addAttachment(created.id, objectIds[i], i);
      }

      const full = await messageRepository.findWithAttachments(created.id);
      const response = toMessageResponse(full);
      try {
        getIO().to(`conv:${convId}`).emit('message:new', response);
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to emit message:new (forward)');
      }
      results.push(response);
    }

    logger.info({ messageId, targets: results.length }, 'Message forwarded');
    return results;
  }
}

module.exports = new MessageService();
