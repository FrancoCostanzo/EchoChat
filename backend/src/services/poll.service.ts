import logger from '../config/logger';
import {
  pollRepository,
  messageRepository,
  conversationRepository,
} from '../repositories';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toMessageResponse, toPollResponse } from '../models';
import { toConversation } from '../config/eventBus';
import type { Row } from '../types/rows';
import type { CreatePollRequest } from '../dtos/poll.dto';

class PollService {
  async createPoll(userId: string, data: CreatePollRequest) {
    const member = await conversationRepository.getMember(data.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    // The poll lives on a message of type 'poll'; body holds the question for
    // search/preview purposes.
    const message = await messageRepository.create({
      conversation_id: data.conversation_id,
      sender_id: userId,
      type: 'poll',
      body: data.question,
    });

    const poll = await pollRepository.createPoll(message.id, data);
    for (let i = 0; i < data.options.length; i++) {
      await pollRepository.addOption(poll.id, data.options[i], i);
    }

    const response = await this._buildMessageWithPoll(message.id, userId);
    try {
      toConversation(data.conversation_id, 'message:new', response);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit message:new (poll)');
    }
    logger.info({ pollId: poll.id, conversationId: data.conversation_id }, 'Poll created');
    return response;
  }

  async vote(userId: string, pollId: string, optionIds: string[]) {
    const poll = await pollRepository.findById(pollId);
    if (!poll) throw new NotFoundError('Poll');
    if (poll.is_closed) throw new BadRequestError('Poll is closed');
    if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
      throw new BadRequestError('Poll has expired');
    }

    const message = await messageRepository.findById(poll.message_id);
    if (!message) throw new NotFoundError('Poll message');
    const member = await conversationRepository.getMember(message.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    // Validate options belong to this poll
    const options = await pollRepository.getOptions(pollId);
    const validIds = new Set(options.map((o) => o.id));
    const chosen = optionIds.filter((id) => validIds.has(id));
    if (chosen.length === 0) throw new BadRequestError('No valid options selected');
    if (!poll.is_multiple && chosen.length > 1) {
      throw new BadRequestError('This poll only allows one option');
    }

    await pollRepository.vote(pollId, chosen, userId, poll.is_multiple ?? false);
    return this._emitPollUpdate(poll, message.conversation_id, userId);
  }

  async retractVote(userId: string, pollId: string) {
    const poll = await pollRepository.findById(pollId);
    if (!poll) throw new NotFoundError('Poll');
    const message = await messageRepository.findById(poll.message_id);
    if (!message) throw new NotFoundError('Poll message');
    const member = await conversationRepository.getMember(message.conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    await pollRepository.retractVote(pollId, userId);
    return this._emitPollUpdate(poll, message.conversation_id, userId);
  }

  async close(userId: string, pollId: string) {
    const poll = await pollRepository.findById(pollId);
    if (!poll) throw new NotFoundError('Poll');
    const message = await messageRepository.findById(poll.message_id);
    if (!message) throw new NotFoundError('Poll message');
    if (message.sender_id !== userId) {
      const member = await conversationRepository.getMember(message.conversation_id, userId);
      if (!member || !['owner', 'admin', 'moderator'].includes(member.role as string)) {
        throw new ForbiddenError('Only the creator or a moderator can close this poll');
      }
    }
    await pollRepository.close(pollId);
    const updated = await pollRepository.findById(pollId);
    if (!updated) throw new NotFoundError('Poll');
    return this._emitPollUpdate(updated, message.conversation_id, userId);
  }

  async getByMessage(messageId: string, userId: string) {
    const poll = await pollRepository.findByMessageId(messageId);
    if (!poll) return null;
    const options = await pollRepository.getOptions(poll.id);
    const myVotes = await pollRepository.getUserVotes(poll.id, userId);
    return toPollResponse(poll, options, myVotes);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  async _buildMessageWithPoll(messageId: string, userId: string) {
    const full = await messageRepository.findWithAttachments(messageId);
    const response = toMessageResponse(full)!;
    response.poll = await this.getByMessage(messageId, userId);
    return response;
  }

  // Emits poll:update to the room (each client recomputes their own `voted`
  // flags on next fetch; the aggregate counts are authoritative here).
  async _emitPollUpdate(poll: Row<'polls'>, conversationId: string, userId: string) {
    const options = await pollRepository.getOptions(poll.id);
    const myVotes = await pollRepository.getUserVotes(poll.id, userId);
    const payload = toPollResponse(poll, options, myVotes);
    try {
      toConversation(conversationId, 'poll:update', {
        conversationId,
        messageId: poll.message_id,
        poll: payload,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to emit poll:update');
    }
    return payload;
  }
}

export default new PollService();
