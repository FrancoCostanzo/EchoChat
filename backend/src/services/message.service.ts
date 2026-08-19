import logger from '../config/logger';
import { toConversation } from '../config/eventBus';
import broadcastService from './broadcast.service';
import {
  messageRepository,
  conversationRepository,
  userRepository,
  auditRepository,
  savedMessageRepository,
  draftRepository,
  pollRepository,
  gameRepository,
  systemSettingsRepository,
} from '../repositories';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toMessageResponse, toSavedMessageResponse, toDraftResponse, toPollResponse, toGameResponse } from '../models';
import { resolveBodyFormat } from '../utils/markdown.util';
import { minioClient } from '../config/minio';
import type { MessageResponse } from '../models/message.model';
import type { GameRow } from '../models/game.model';
import type { ReceiptDetail } from '../repositories/message.repository';
import type {
  SendMessageRequest,
  PaginationRequest,
  DraftRequest,
} from '../dtos/message.dto';

const AVATAR_BUCKET = 'messaging-avatars';
const DEFAULT_EDIT_WINDOW_MINUTES = 15;
const DEFAULT_DELETE_WINDOW_MINUTES = 15;

/** Lee una ventana de tiempo de system_settings, cayendo al default si no es válida. */
async function getWindowMinutes(key: string, defaultMinutes: number): Promise<number> {
  try {
    const row = await systemSettingsRepository.findByKey(key);
    const raw = row?.value;
    const minutes = parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(minutes) || minutes < 0) return defaultMinutes;
    return minutes;
  } catch {
    return defaultMinutes;
  }
}

function assertWithinWindow(sentAt: Date | string | null, minutes: number, action: string): void {
  // 0 = unlimited (same convention as message_retention_days).
  if (minutes === 0) return;
  const sentMs = new Date(sentAt as Date).getTime();
  if (!Number.isFinite(sentMs)) {
    throw new BadRequestError(`Cannot ${action} this message`);
  }
  const elapsedMs = Date.now() - sentMs;
  if (elapsedMs > minutes * 60 * 1000) {
    throw new ForbiddenError(
      `Can only ${action} messages within ${minutes} minutes of sending`,
    );
  }
}

async function withAvatarUrl<T extends { avatar_object_key?: string | null; avatar_bucket?: string | null }>(user: T) {
  if (!user?.avatar_object_key) return user;
  try {
    const url = await minioClient.presignedGetObject(
      user.avatar_bucket || AVATAR_BUCKET,
      user.avatar_object_key,
      60 * 60,
    );
    return { ...user, avatar_url: url };
  } catch {
    return user;
  }
}

class MessageService {
  async send(userId: string, data: SendMessageRequest): Promise<MessageResponse> {
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

    if (data.type === 'code') {
      data.body_format = 'plain';
      const lang = (data.metadata as any)?.language || 'plaintext';
      data.metadata = { ...data.metadata, language: lang };
    }

    const message = await messageRepository.create({
      ...data,
      sender_id: userId,
      body_format: data.type === 'code' ? 'plain' : resolveBodyFormat(data.body, data.body_format),
    });

    // Add attachments if any
    if (data.attachment_ids && data.attachment_ids.length > 0) {
      for (let i = 0; i < data.attachment_ids.length; i++) {
        await messageRepository.addAttachment(message.id, data.attachment_ids[i], i);
      }
    }

    const full = await messageRepository.findWithAttachments(message.id);
    logger.info({ messageId: message.id, conversationId: data.conversation_id }, 'Message sent');

    const response = toMessageResponse(full)!;
    try {
      toConversation(data.conversation_id, 'message:new', response);
      // Let open timelines refresh the root's reply counter without refetching
      if (response.thread_id) {
        const threadCount = await messageRepository.countThreadReplies(response.thread_id);
        toConversation(data.conversation_id, 'message:thread_count', {
          messageId: response.thread_id,
          thread_count: threadCount,
        });
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:new');
    }
    return response;
  }

  // Root message + ordered replies for the thread side panel
  async getThread(messageId: string, userId: string) {
    const root = await messageRepository.findWithAttachments(messageId, userId);
    if (!root) throw new NotFoundError('Message');
    const member = await conversationRepository.getMember(root.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const replies = await messageRepository.findThreadReplies(messageId, { viewerUserId: userId });
    const rootResponse = toMessageResponse(root)!;
    const replyResponses = replies.map((r) => toMessageResponse(r)!);
    await this._attachPolls([rootResponse, ...replyResponses], userId);
    await this._attachGames([rootResponse, ...replyResponses], userId);
    return { root: rootResponse, replies: replyResponses };
  }

  async getMessages(conversationId: string, userId: string, pagination?: PaginationRequest) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.findByConversation(conversationId, {
      ...pagination,
      viewerUserId: userId,
    });
    const responses = messages.map((m) => toMessageResponse(m)!);
    await this._attachPolls(responses, userId);
    await this._attachGames(responses, userId);
    return responses;
  }

  // Attach poll data (options + the user's votes) to any 'poll' type messages.
  async _attachPolls(responses: MessageResponse[], userId: string) {
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

  // Attach game state (board/choices/masked word, redacted per viewer) to
  // any 'game' type messages.
  async _attachGames(responses: MessageResponse[], userId: string) {
    for (const m of responses) {
      if (m.type !== 'game') continue;
      const game = (await gameRepository.findByMessageId(m.id)) as GameRow | null;
      if (!game) continue;
      m.game = toGameResponse(game, userId);
    }
    return responses;
  }

  async getById(messageId: string) {
    const message = await messageRepository.findWithAttachments(messageId);
    if (!message) throw new NotFoundError('Message');
    return toMessageResponse(message);
  }

  async update(messageId: string, userId: string, body: string, bodyFormat?: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    if (message.is_deleted) throw new BadRequestError('Cannot edit a deleted message');
    if (message.sender_id !== userId) throw new ForbiddenError('Can only edit your own messages');

    const editWindow = await getWindowMinutes('message_edit_window_minutes', DEFAULT_EDIT_WINDOW_MINUTES);
    assertWithinWindow(message.sent_at, editWindow, 'edit');

    const format = resolveBodyFormat(body, bodyFormat);
    const updated = await messageRepository.updateBody(messageId, body, userId, format);
    logger.info({ messageId }, 'Message edited');

    const response = toMessageResponse(updated);
    try {
      toConversation(message.conversation_id, 'message:edited', response);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:edited');
    }
    return response;
  }

  async delete(messageId: string, userId: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    if (message.is_deleted) throw new BadRequestError('Message already deleted');

    // Owners delete their own messages; others need the global `messages.delete_any`
    // permission (moderators/admins). This connects per-message ownership with RBAC.
    const isOwner = message.sender_id === userId;
    const canDeleteAny = await userRepository.hasPermission(userId, 'messages.delete_any');
    if (!isOwner && !canDeleteAny) {
      throw new ForbiddenError('Can only delete your own messages');
    }

    // Own deletes respect the time window; moderators with delete_any can always
    // remove messages (including their own past the window).
    if (!canDeleteAny) {
      const deleteWindow = await getWindowMinutes(
        'message_delete_window_minutes',
        DEFAULT_DELETE_WINDOW_MINUTES,
      );
      assertWithinWindow(message.sent_at, deleteWindow, 'delete');
    }

    // Delete attachments from MinIO before soft-deleting the message
    const attachmentObjects = await messageRepository.getAttachmentObjects(messageId);
    for (const obj of attachmentObjects) {
      try {
        await minioClient.removeObject(obj.bucket_name, obj.object_key);
      } catch (err) {
        logger.warn({ err: (err as Error).message, objectKey: obj.object_key }, 'Failed to delete object from MinIO');
      }
      if (obj.thumbnail_bucket && obj.thumbnail_key) {
        try {
          await minioClient.removeObject(obj.thumbnail_bucket, obj.thumbnail_key);
        } catch (err) {
          logger.warn({ err: (err as Error).message }, 'Failed to delete thumbnail from MinIO');
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
      severity: isOwner ? 'info' : 'warning',
      category: 'content',
      data_before: { conversation_id: message.conversation_id, sender_id: message.sender_id },
      data_after: { by_owner: isOwner },
    }).catch((err: Error) => logger.warn({ err: err.message }, 'Failed to write audit log'));

    const response = toMessageResponse(deleted);
    try {
      toConversation(message.conversation_id, 'message:deleted', response);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:deleted');
    }
    return response;
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    await messageRepository.toggleReaction(messageId, userId, emoji);
    const reactions = await messageRepository.getReactions(messageId);
    try {
      const message = await messageRepository.findById(messageId);
      if (message) {
        toConversation(message.conversation_id, 'message:reaction', { messageId, reactions });
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:reaction');
    }
    return reactions;
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    await messageRepository.removeReaction(messageId, userId, emoji);
    const reactions = await messageRepository.getReactions(messageId);
    try {
      const message = await messageRepository.findById(messageId);
      if (message) {
        toConversation(message.conversation_id, 'message:reaction', { messageId, reactions });
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:reaction');
    }
    return reactions;
  }

  async addReceipt(messageId: string, userId: string, type: string) {
    const receipt = await messageRepository.addReceipt(messageId, userId, type);
    try {
      const message = await messageRepository.findById(messageId);
      const counts = await messageRepository.getReceiptCounts(messageId);
      if (message) {
        toConversation(message.conversation_id, 'message:receipt', {
          messageId,
          conversationId: message.conversation_id,
          delivered_count: parseInt(String(counts.delivered_count), 10) || 0,
          read_count: parseInt(String(counts.read_count), 10) || 0,
        });
      }

      await broadcastService.syncFromMessageReceipt(messageId, userId, type);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:receipt');
    }
    return receipt;
  }

  async search(conversationId: string, userId: string, term: string, limit?: number) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.search(conversationId, term, limit);
    return messages.map(toMessageResponse);
  }

  // "Información del mensaje": cuándo se envió y, por destinatario, cuándo se
  // entregó y se leyó. Accesible para cualquier miembro de la conversación.
  async getMessageInfo(messageId: string, userId: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    const member = await conversationRepository.getMember(message.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const receipts = await messageRepository.getReceipts(messageId);
    return {
      id: message.id,
      sender_id: message.sender_id,
      sent_at: message.sent_at,
      is_edited: message.is_edited,
      edited_at: message.edited_at,
      receipts: await Promise.all(receipts.map(async (r: ReceiptDetail) => {
        const withUrl = await withAvatarUrl(r).catch(() => r);
        return {
          user_id: r.user_id,
          display_name: r.display_name,
          username: r.username,
          avatar_url: (withUrl as { avatar_url?: string }).avatar_url ?? null,
          delivered_at: r.delivered_at,
          read_at: r.read_at,
        };
      })),
    };
  }

  async pinMessage(conversationId: string, messageId: string, userId: string) {
    return messageRepository.pinMessage(conversationId, messageId, userId);
  }

  async unpinMessage(conversationId: string, messageId: string) {
    return messageRepository.unpinMessage(conversationId, messageId);
  }

  async getPinnedMessages(conversationId: string, userId: string) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const messages = await messageRepository.getPinnedMessages(conversationId);
    return messages.map(toMessageResponse);
  }

  // ── Saved messages ────────────────────────────────────────────────────────
  async saveMessage(userId: string, messageId: string, note?: string | null) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message');
    const member = await conversationRepository.getMember(message.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    return savedMessageRepository.save(userId, messageId, note);
  }

  async unsaveMessage(userId: string, messageId: string): Promise<void> {
    await savedMessageRepository.unsave(userId, messageId);
  }

  async listSaved(userId: string, pagination?: { limit?: number; offset?: number }) {
    const rows = await savedMessageRepository.list(userId, pagination);
    return rows.map(toSavedMessageResponse);
  }

  // ── Drafts ──────────────────────────────────────────────────────────────
  async saveDraft(userId: string, conversationId: string, data: DraftRequest) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const draft = await draftRepository.upsert(userId, conversationId, data);
    return toDraftResponse(draft);
  }

  async getDraft(userId: string, conversationId: string) {
    const draft = await draftRepository.get(userId, conversationId);
    return draft ? toDraftResponse(draft) : null;
  }

  async deleteDraft(userId: string, conversationId: string): Promise<void> {
    await draftRepository.remove(userId, conversationId);
  }

  async listDrafts(userId: string) {
    const drafts = await draftRepository.listByUser(userId);
    return drafts.map(toDraftResponse);
  }

  // ── Forwarding ────────────────────────────────────────────────────────────
  async forward(userId: string, messageId: string, conversationIds: string[]) {
    const source = await messageRepository.findById(messageId);
    if (!source) throw new NotFoundError('Message');
    const srcMember = await conversationRepository.getMember(source.conversation_id, userId);
    if (!srcMember) throw new ForbiddenError('Not a member of the source conversation');

    const objectIds = await messageRepository.getAttachmentObjectIds(messageId);
    const results: MessageResponse[] = [];

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
      const response = toMessageResponse(full)!;
      try {
        toConversation(convId, 'message:new', response);
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'Failed to emit message:new (forward)');
      }
      results.push(response);
    }

    logger.info({ messageId, targets: results.length }, 'Message forwarded');
    return results;
  }
}

export default new MessageService();
