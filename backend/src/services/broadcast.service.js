const logger = require('../config/logger');
const { broadcastRepository } = require('../repositories');
const { NotFoundError, ForbiddenError } = require('../errors');

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

    logger.info({ broadcastMsgId: message.id, broadcastId: listId }, 'Broadcast message created');
    return message;
  }

  async addRecipients(listId, userId, recipientIds) {
    await this.getListById(listId, userId);
    await broadcastRepository.addRecipients(listId, recipientIds, userId);
    return broadcastRepository.getRecipients(listId);
  }

  async removeRecipient(listId, userId, recipientId) {
    await this.getListById(listId, userId);
    await broadcastRepository.removeRecipient(listId, recipientId);
    return broadcastRepository.getRecipients(listId);
  }
}

module.exports = new BroadcastService();
