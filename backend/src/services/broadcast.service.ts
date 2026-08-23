import logger from '../config/logger';
import {
  broadcastRepository,
  conversationRepository,
  messageRepository,
  notificationRepository,
} from '../repositories';
import { minioClient } from '../config/minio';
import { NotFoundError, ForbiddenError } from '../errors';
import { toMessageResponse } from '../models';
import { toConversation, toUser } from '../config/eventBus';
import type {
  RecipientWithUser,
  BroadcastMessageWithStats,
  DeliveryDetail,
  ListWithCount,
} from '../repositories/broadcast.repository';
import type {
  CreateBroadcastListRequest,
  SendBroadcastRequest,
  AddBroadcastRecipientsRequest,
} from '../dtos/broadcast.dto';

const AVATAR_BUCKET = 'messaging-avatars';

/** Fila con avatar: tanto destinatarios como entregas traen las mismas claves. */
type ConAvatar = { avatar_object_key?: string | null; avatar_bucket?: string | null; user_id?: string };

async function withRecipientAvatar<T extends ConAvatar>(recipient: T) {
  if (!recipient?.avatar_object_key) return recipient;
  try {
    const url = await minioClient.presignedGetObject(
      recipient.avatar_bucket || AVATAR_BUCKET,
      recipient.avatar_object_key,
      60 * 60 * 24,
    );
    return { ...recipient, avatar_url: url };
  } catch (err) {
    logger.warn({ err, userId: recipient.user_id }, 'Failed to generate broadcast recipient avatar URL');
    return recipient;
  }
}

async function enrichRecipients<T extends ConAvatar>(recipients: T[]) {
  return Promise.all((recipients || []).map(withRecipientAvatar));
}

async function withSenderAvatar(message: BroadcastMessageWithStats) {
  if (!message?.sender_avatar_object_key) return message;
  try {
    const url = await minioClient.presignedGetObject(
      message.sender_avatar_bucket || AVATAR_BUCKET,
      message.sender_avatar_object_key,
      60 * 60 * 24,
    );
    return { ...message, sender_avatar_url: url };
  } catch (err) {
    logger.warn({ err, messageId: message.id }, 'Failed to generate broadcast sender avatar URL');
    return message;
  }
}

/** Lista con sus destinatarios ya resueltos (los cuelga getListById). */
type ListConDestinatarios = ListWithCount & { recipients?: unknown[] };

class BroadcastService {
  async createList(userId: string, data: CreateBroadcastListRequest) {
    const list = await broadcastRepository.createList({
      name: data.name,
      description: data.description,
      owner_id: userId,
    });
    await broadcastRepository.addRecipients(list.id, data.recipient_ids, userId);
    logger.info({ broadcastId: list.id }, 'Broadcast list created');
    return list;
  }

  async getLists(userId: string) {
    return broadcastRepository.findByOwner(userId);
  }

  async getListById(listId: string, userId: string): Promise<ListConDestinatarios> {
    const list = (await broadcastRepository.findById(listId)) as ListConDestinatarios | null;
    if (!list) throw new NotFoundError('Broadcast list');
    if (list.owner_id !== userId) throw new ForbiddenError('Not the owner of this broadcast list');
    list.recipients = await enrichRecipients(await broadcastRepository.getRecipients(listId));
    return list;
  }

  async getMessages(listId: string, userId: string) {
    await this.getListById(listId, userId);
    const messages = await broadcastRepository.findMessagesByListId(listId);
    return Promise.all(messages.map(withSenderAvatar));
  }

  async getDeliveries(listId: string, messageId: string, userId: string) {
    await this.getListById(listId, userId);
    const message = await broadcastRepository.findMessageById(messageId);
    if (!message || message.broadcast_list_id !== listId) {
      throw new NotFoundError('Broadcast message');
    }
    return enrichRecipients<DeliveryDetail>(await broadcastRepository.getDeliveries(messageId));
  }

  /**
   * When a DM gets a client delivery/read receipt, update the matching
   * broadcast_deliveries row (if this DM was created by a broadcast).
   */
  async syncFromMessageReceipt(messageId: string, userId: string, type: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) return null;
    let meta: any = message.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = {}; }
    }
    const broadcastMsgId = meta?.broadcast_msg_id;
    if (!broadcastMsgId) return null;

    await broadcastRepository.syncDeliveryReceipt(broadcastMsgId, userId, {
      received: true,
      read: type === 'read',
    });
    return broadcastRepository.refreshMessageTotals(broadcastMsgId);
  }

  async sendMessage(listId: string, userId: string, data: SendBroadcastRequest) {
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

  async addRecipients(
    listId: string,
    userId: string,
    { recipient_ids = [], department }: AddBroadcastRecipientsRequest,
  ) {
    await this.getListById(listId, userId);
    let ids = [...recipient_ids];
    if (department) {
      const deptIds = await broadcastRepository.findUserIdsByDepartment(department);
      ids = [...new Set([...ids, ...deptIds])];
    }
    if (!ids.length) {
      return enrichRecipients(await broadcastRepository.getRecipients(listId));
    }
    await broadcastRepository.addRecipients(listId, ids, userId);
    return enrichRecipients(await broadcastRepository.getRecipients(listId));
  }

  async removeRecipient(listId: string, userId: string, recipientId: string) {
    await this.getListById(listId, userId);
    await broadcastRepository.removeRecipient(listId, recipientId);
    return enrichRecipients(await broadcastRepository.getRecipients(listId));
  }

  async processDueScheduled(): Promise<number> {
    const due = await broadcastRepository.findDueScheduledMessages();
    for (const msg of due) {
      try {
        await this.dispatchMessage(msg.id);
      } catch (err) {
        logger.warn({ err: (err as Error).message, broadcastMsgId: msg.id }, 'Scheduled broadcast dispatch failed');
      }
    }
    return due.length;
  }

  async _findOrCreateDirect(senderId: string, recipientId: string) {
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

  async dispatchMessage(messageId: string) {
    const message = await broadcastRepository.findMessageById(messageId);
    if (!message || !['draft', 'scheduled'].includes(message.status as string)) return null;

    await broadcastRepository.updateMessageStatus(messageId, { status: 'sending' });

    const list = await broadcastRepository.findById(message.broadcast_list_id);
    const recipients: RecipientWithUser[] = await broadcastRepository.getRecipients(message.broadcast_list_id);
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
            broadcast_list_name: list?.name || null,
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
          // Emit to the DM room *and* personal rooms: a newly created direct
          // conversation isn't joined until reconnect, so recipients would
          // otherwise miss the realtime event entirely.
          toConversation(conv.id, 'message:new', response);
          toUser(recipient.user_id, 'message:new', response);
          toUser(message.sender_id, 'message:new', response);
          toUser(recipient.user_id, 'notification:new', { type: 'broadcast' });
        } catch {
          // Socket not initialised — skip realtime.
        }

        delivered++;
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, broadcastMsgId: messageId, recipientId: recipient.user_id },
          'Broadcast delivery failed for recipient',
        );
      }
    }

    // total_delivered / total_read track *client* receipts, not fan-out —
    // start at 0 and bump via message.service.addReceipt.
    const updated = await broadcastRepository.updateMessageStatus(messageId, {
      status: delivered > 0 ? 'sent' : 'failed',
      sent_at: new Date(),
      total_recipients: total,
      total_delivered: 0,
      total_read: 0,
    });

    logger.info({ broadcastMsgId: messageId, delivered, total }, 'Broadcast dispatched');
    return updated;
  }
}

export default new BroadcastService();
