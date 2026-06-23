const logger = require('../config/logger');
const {
  broadcastRepository,
  conversationRepository,
  messageRepository,
  notificationRepository,
} = require('../repositories');
const { NotFoundError, ForbiddenError } = require('../errors');
const { toMessageResponse } = require('../models');

function getIO() {
  return require('../socket').getIO();
}

class BroadcastService {
  async createList(userId, data) {
    const list = await broadcastRepository.createList({
      name: data.name,
      description: data.description,
      owner_id: userId,
    });
    await broadcastRepository.addRecipients(list.id, data.recipient_ids, userId);
    logger.info({ broadcastId: list.id }, 'Broadcast list created');
    return list;
  }

  async getLists(userId) {
    return broadcastRepository.findByOwner(userId);
  }

  async getListById(listId, userId) {
    const list = await broadcastRepository.findById(listId);
    if (!list) throw new NotFoundError('Broadcast list');
    if (list.owner_id !== userId) throw new ForbiddenError('Not the owner of this broadcast list');
    list.recipients = await broadcastRepository.getRecipients(listId);
    return list;
  }

  async getMessages(listId, userId) {
    await this.getListById(listId, userId);
    return broadcastRepository.findMessagesByListId(listId);
  }

  async sendMessage(listId, userId, data) {
    const list = await broadcastRepository.findById(listId);
    if (!list) throw new NotFoundError('Broadcast list');
    if (list.owner_id !== userId) throw new ForbiddenError('Not the owner of this broadcast list');

    const message = await broadcastRepository.createMessage({
      broadcast_list_id: listId,
      sender_id: userId,
      body: data.body,
      type: data.type,
      object_id: data.object_id,
      scheduled_at: data.scheduled_at,
    });

    const isFuture = data.scheduled_at && new Date(data.scheduled_at) > new Date();
    if (!isFuture) {
      await this.dispatchMessage(message.id);
      return broadcastRepository.findMessageById(message.id);
    }

    logger.info({ broadcastMsgId: message.id, broadcastId: listId }, 'Broadcast message scheduled');
    return message;
  }

  async addRecipients(listId, userId, { recipient_ids = [], department }) {
    await this.getListById(listId, userId);
    let ids = [...recipient_ids];
    if (department) {
      const deptIds = await broadcastRepository.findUserIdsByDepartment(department);
      ids = [...new Set([...ids, ...deptIds])];
    }
    if (!ids.length) return broadcastRepository.getRecipients(listId);
    await broadcastRepository.addRecipients(listId, ids, userId);
    return broadcastRepository.getRecipients(listId);
  }

  async removeRecipient(listId, userId, recipientId) {
    await this.getListById(listId, userId);
    await broadcastRepository.removeRecipient(listId, recipientId);
    return broadcastRepository.getRecipients(listId);
  }

  async processDueScheduled() {
    const due = await broadcastRepository.findDueScheduledMessages();
    for (const msg of due) {
      try {
        await this.dispatchMessage(msg.id);
      } catch (err) {
        logger.warn({ err: err.message, broadcastMsgId: msg.id }, 'Scheduled broadcast dispatch failed');
      }
    }
    return due.length;
  }

  async _findOrCreateDirect(senderId, recipientId) {
    const existing = await conversationRepository.findDirectBetween(senderId, recipientId);
    if (existing) return existing;

    const conversation = await conversationRepository.create({
      type: 'direct',
      created_by: senderId,
    });
    await conversationRepository.addMember(conversation.id, senderId, 'owner');
    await conversationRepository.addMember(conversation.id, recipientId, 'member', senderId);
    return conversation;
  }

  async dispatchMessage(messageId) {
    const message = await broadcastRepository.findMessageById(messageId);
    if (!message || !['draft', 'scheduled'].includes(message.status)) return null;

    await broadcastRepository.updateMessageStatus(messageId, { status: 'sending' });

    const list = await broadcastRepository.findById(message.broadcast_list_id);
    const recipients = await broadcastRepository.getRecipients(message.broadcast_list_id);
    const total = recipients.length;
    let delivered = 0;

    for (const recipient of recipients) {
      try {
        const conv = await this._findOrCreateDirect(message.sender_id, recipient.user_id);
        const dmMessage = await messageRepository.create({
          conversation_id: conv.id,
          sender_id: message.sender_id,
          type: message.type || 'text',
          body: message.body,
          metadata: {
            broadcast_msg_id: message.id,
            broadcast_list_id: message.broadcast_list_id,
          },
        });

        if (message.object_id) {
          await messageRepository.addAttachment(dmMessage.id, message.object_id, 0);
        }

        const full = await messageRepository.findWithAttachments(dmMessage.id);
        const response = toMessageResponse(full);

        await broadcastRepository.createDelivery({
          broadcast_msg_id: message.id,
          user_id: recipient.user_id,
          conversation_id: conv.id,
        });

        await notificationRepository.create({
          recipient_id: recipient.user_id,
          type: 'broadcast',
          title: list?.name || 'Broadcast',
          body: message.body?.substring(0, 200) || null,
          reference_type: 'broadcast_message',
          reference_id: message.id,
          channel: 'in_app',
        });

        try {
          getIO().to(`conv:${conv.id}`).emit('message:new', response);
          getIO().to(`user:${recipient.user_id}`).emit('notification:new', { type: 'broadcast' });
        } catch {
          // Socket not initialised — skip realtime.
        }

        delivered++;
      } catch (err) {
        logger.warn(
          { err: err.message, broadcastMsgId: messageId, recipientId: recipient.user_id },
          'Broadcast delivery failed for recipient',
        );
      }
    }

    const updated = await broadcastRepository.updateMessageStatus(messageId, {
      status: delivered > 0 ? 'sent' : 'failed',
      sent_at: new Date(),
      total_recipients: total,
      total_delivered: delivered,
    });

    logger.info({ broadcastMsgId: messageId, delivered, total }, 'Broadcast dispatched');
    return updated;
  }
}

module.exports = new BroadcastService();
