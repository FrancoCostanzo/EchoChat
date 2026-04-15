const logger = require('../config/logger');
const { callRepository } = require('../repositories');
const { NotFoundError, ForbiddenError } = require('../errors');
const { toCallResponse } = require('../models');

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

    const updated = await callRepository.updateStatus(callId, status, endReason);
    updated.participants = await callRepository.getParticipants(callId);
    logger.info({ callId, status }, 'Call status updated');
    return toCallResponse(updated);
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
}

module.exports = new CallService();
