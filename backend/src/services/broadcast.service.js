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
}

module.exports = new BroadcastService();
