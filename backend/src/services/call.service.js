const logger = require('../config/logger');
const { callRepository, messageRepository } = require('../repositories');
const { NotFoundError, ForbiddenError } = require('../errors');
const { toCallResponse, toMessageResponse, toCallHistoryItem } = require('../models');
const { minioClient } = require('../config/minio');
const { toConversation } = require('../config/eventBus');

const AVATAR_BUCKET = 'messaging-avatars';

// Firma la URL del avatar (directos) para que el frontend muestre la foto.
async function withAvatarUrl(item) {
  if (!item?.avatar_key) return item;
  try {
    const url = await minioClient.presignedGetObject(AVATAR_BUCKET, item.avatar_key, 60 * 60 * 24);
    return { ...item, avatar_url: url };
  } catch {
    return item;
  }
}


const TERMINAL_STATUSES = ['ended', 'missed', 'rejected', 'failed'];

class CallService {
  async initiate(userId, data) {
    const call = await callRepository.create({
      conversation_id: data.conversation_id,
      type: data.type,
      initiated_by: userId,
    });

    // Add initiator as first participant
    await callRepository.addParticipant(call.id, userId);
    await callRepository.updateParticipant(call.id, userId, { status: 'joined' });

    // Invite other participants
    for (const pid of data.participant_ids) {
      if (pid !== userId) {
        await callRepository.addParticipant(call.id, pid);
      }
    }

    const participants = await callRepository.getParticipants(call.id);
    call.participants = participants;
    logger.info({ callId: call.id, type: data.type }, 'Call initiated');
    return toCallResponse(call);
  }

  async getById(callId) {
    const call = await callRepository.findById(callId);
    if (!call) throw new NotFoundError('Call');
    call.participants = await callRepository.getParticipants(callId);
    return toCallResponse(call);
  }

  async updateStatus(callId, userId, status, endReason) {
    const call = await callRepository.findById(callId);
    if (!call) throw new NotFoundError('Call');

    const wasTerminal = TERMINAL_STATUSES.includes(call.status);
    const updated = await callRepository.updateStatus(callId, status, endReason);
    updated.participants = await callRepository.getParticipants(callId);
    logger.info({ callId, status }, 'Call status updated');

    // Al finalizar por primera vez, dejamos un evento en el timeline de la
    // conversación. Sirve de aviso en el chat y de historial persistente.
    if (!wasTerminal && TERMINAL_STATUSES.includes(status) && updated.conversation_id) {
      await this._emitCallEvent(updated).catch((err) =>
        logger.warn({ err: err.message, callId }, 'Failed to post call event message'),
      );
    }
    return toCallResponse(updated);
  }

  // Inserta y difunde un mensaje de sistema que resume la llamada finalizada.
  async _emitCallEvent(call) {
    const outcome =
      call.status === 'ended' ? 'completed'
      : call.status === 'rejected' ? 'declined'
      : 'missed';

    const message = await messageRepository.create({
      conversation_id: call.conversation_id,
      sender_id: call.initiated_by,   // atribuido al que inició; se renderiza centrado
      type: 'system',
      body: null,
      metadata: {
        event: 'call',
        call_id: call.id,
        call_type: call.type,
        outcome,
        duration_seconds: call.duration_seconds || 0,
        initiated_by: call.initiated_by,
      },
    });

    const full = await messageRepository.findWithAttachments(message.id);
    const response = toMessageResponse(full);
    try {
      toConversation(call.conversation_id, 'message:new', response);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit call event message:new');
    }
    return response;
  }

  async updateParticipant(callId, userId, fields) {
    const participant = await callRepository.updateParticipant(callId, userId, fields);
    if (!participant) throw new NotFoundError('Call participant');
    return participant;
  }

  async getByConversation(conversationId, pagination) {
    const calls = await callRepository.findByConversation(conversationId, pagination);
    return calls.map(toCallResponse);
  }

  async getActiveByUser(userId) {
    const calls = await callRepository.findActiveByUser(userId);
    return calls.map(toCallResponse);
  }

  async getHistoryByUser(userId, pagination, filter) {
    const rows = await callRepository.findByUser(userId, { ...pagination, filter });
    return Promise.all(rows.map((row) => withAvatarUrl(toCallHistoryItem(row))));
  }
}

module.exports = new CallService();
