import logger from '../config/logger';
import { callRepository, conversationRepository, messageRepository, userRepository } from '../repositories';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors';
import { toCallResponse, toMessageResponse, toCallHistoryItem } from '../models';
import { publicMinioClient } from '../config/minio';
import { toConversation } from '../config/eventBus';
import type { CallRow } from '../models/call.model';
import type { CallHistoryItem } from '../models/call.model';
import type { InitiateCallRequest, UpdateParticipantRequest } from '../dtos/call.dto';
import type { Row } from '../types/rows';

const AVATAR_BUCKET = 'messaging-avatars';

async function signAvatar(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return await publicMinioClient.presignedGetObject(AVATAR_BUCKET, key, 60 * 60 * 24);
  } catch {
    return null;
  }
}

// Firma la URL del avatar (directos) para que el frontend muestre la foto.
async function withAvatarUrl(item: CallHistoryItem | null) {
  if (!item?.avatar_key) return item;
  const url = await signAvatar(item.avatar_key);
  return url ? { ...item, avatar_url: url } : item;
}

const TERMINAL_STATUSES = ['ended', 'missed', 'rejected', 'failed'];

const PERMISSION_BY_TYPE: Record<string, string> = {
  voice: 'calls.make_voice',
  video: 'calls.make_video',
  screen_share: 'calls.make_video',
  conference: 'calls.make_conference',
};

// Los ids de llamada de la señalización vienen del cliente sin pasar por Joi:
// sin este filtro un id mal formado haría fallar la query de Postgres.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ajustes de participante que sólo puede tocar quien inició la llamada.
const HOST_FIELDS = ['can_speak', 'can_video', 'can_share_screen', 'is_muted_by_host'] as const;

class CallService {
  async initiate(userId: string, data: InitiateCallRequest) {
    const permission = PERMISSION_BY_TYPE[data.type];
    if (!(await userRepository.hasPermission(userId, permission))) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }

    const invitees = [...new Set(data.participant_ids)].filter((id) => id !== userId);
    if (invitees.length === 0) throw new BadRequestError('A call needs at least one other participant');

    // En una conversación sólo se puede llamar a sus miembros, y sólo si uno lo es.
    if (data.conversation_id) {
      const [member] = await conversationRepository.filterActiveMemberIds(data.conversation_id, [userId]);
      if (!member) throw new ForbiddenError('Not a member of this conversation');
      const members = await conversationRepository.filterActiveMemberIds(data.conversation_id, invitees);
      if (members.length !== invitees.length) {
        throw new BadRequestError('All participants must be members of the conversation');
      }
    }

    const call: CallRow = await callRepository.create({
      conversation_id: data.conversation_id,
      type: data.type,
      initiated_by: userId,
    });

    // Add initiator as first participant
    await callRepository.addParticipant(call.id, userId);
    await callRepository.updateParticipant(call.id, userId, { status: 'joined' });

    // Invite other participants
    for (const pid of invitees) {
      await callRepository.addParticipant(call.id, pid);
    }

    const participants = await callRepository.getParticipants(call.id);
    call.participants = participants;
    logger.info({ callId: call.id, type: data.type }, 'Call initiated');
    return toCallResponse(call);
  }

  async getById(callId: string, userId: string) {
    const call = await this._findAsParticipant(callId, userId);
    call.participants = await callRepository.getParticipants(callId);
    return toCallResponse(call);
  }

  async updateStatus(callId: string, userId: string, status: string, endReason?: string | null) {
    const call = await this._findAsParticipant(callId, userId);

    const wasTerminal = TERMINAL_STATUSES.includes(call.status as string);
    const updated: CallRow = await callRepository.updateStatus(callId, status, endReason ?? null);
    updated.participants = await callRepository.getParticipants(callId);
    logger.info({ callId, status }, 'Call status updated');

    // Al finalizar por primera vez, dejamos un evento en el timeline de la
    // conversación. Sirve de aviso en el chat y de historial persistente.
    if (!wasTerminal && TERMINAL_STATUSES.includes(status) && updated.conversation_id) {
      await this._emitCallEvent(updated).catch((err: Error) =>
        logger.warn({ err: err.message, callId }, 'Failed to post call event message'),
      );
    }
    return toCallResponse(updated);
  }

  // Inserta y difunde un mensaje de sistema que resume la llamada finalizada.
  async _emitCallEvent(call: CallRow) {
    // updateStatus sólo llama acá con llamadas que tienen conversación (una
    // llamada suelta no tiene timeline donde dejar el evento).
    if (!call.conversation_id) return;

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
      logger.warn({ err: (err as Error).message }, 'Failed to emit call event message:new');
    }
    return response;
  }

  /**
   * Cada participante actualiza su propio estado; los permisos dentro de la
   * llamada (micrófono, cámara, pantalla) sólo los cambia quien la inició.
   */
  async updateParticipant(
    callId: string,
    actorId: string,
    userId: string,
    fields: UpdateParticipantRequest,
  ) {
    const call = await this._findAsParticipant(callId, actorId);
    const isHost = call.initiated_by === actorId;
    if (actorId !== userId && !isHost) {
      throw new ForbiddenError('Only the call host can update other participants');
    }
    if (!isHost && HOST_FIELDS.some((f) => fields[f] !== undefined)) {
      throw new ForbiddenError('Only the call host can change participant permissions');
    }

    const participant = await callRepository.updateParticipant(callId, userId, fields);
    if (!participant) throw new NotFoundError('Call participant');
    return participant;
  }

  async getByConversation(
    conversationId: string,
    userId: string,
    pagination?: { limit?: number; offset?: number },
  ) {
    const [member] = await conversationRepository.filterActiveMemberIds(conversationId, [userId]);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const calls = await callRepository.findByConversation(conversationId, pagination);
    return calls.map(toCallResponse);
  }

  async getActiveByUser(userId: string) {
    const calls = await callRepository.findActiveByUser(userId);
    return calls.map(toCallResponse);
  }

  async getHistoryByUser(
    userId: string,
    pagination: { limit?: number; offset?: number } | undefined,
    filter?: string,
  ) {
    const rows = await callRepository.findByUser(userId, { ...pagination, filter });
    return Promise.all(rows.map((row) => withAvatarUrl(toCallHistoryItem(row))));
  }

  /**
   * Para la señalización por socket: si `userId` participa de la llamada,
   * devuelve la llamada y los ids del resto de participantes; si no, null.
   * Con `liveOnly` también descarta llamadas ya terminadas.
   */
  async getPeers(
    callId: unknown,
    userId: string,
    { liveOnly = false }: { liveOnly?: boolean } = {},
  ): Promise<{ call: CallRow; peerIds: string[] } | null> {
    if (typeof callId !== 'string' || !UUID_RE.test(callId)) return null;
    const call: CallRow | null = await callRepository.findById(callId);
    if (!call) return null;
    if (liveOnly && TERMINAL_STATUSES.includes(call.status as string)) return null;
    const ids = await callRepository.getParticipantIds(callId);
    if (!ids.includes(userId)) return null;
    return { call, peerIds: ids.filter((id) => id !== userId) };
  }

  /** Quién llama, armado en el servidor: el cliente no puede hacerse pasar por otro. */
  async describeCaller(user: Row<'users'>) {
    return {
      id: user.id,
      display_name: user.display_name,
      avatar_url: await signAvatar(user.avatar_object_key),
    };
  }

  async _findAsParticipant(callId: string, userId: string): Promise<CallRow> {
    const call: CallRow | null = await callRepository.findById(callId);
    if (!call) throw new NotFoundError('Call');
    const ids = await callRepository.getParticipantIds(callId);
    if (!ids.includes(userId)) throw new ForbiddenError('Not a participant of this call');
    return call;
  }
}

export default new CallService();
