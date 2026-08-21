import logger from '../config/logger';
import { conversationRepository, auditRepository } from '../repositories';
import { toConversation } from '../config/eventBus';
import storageService from './storage.service';
import { urlDeAvatar } from '../utils/avatarUrl.util';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors';
import { toConversationResponse, toMemberResponse } from '../models';
import type { ConversationResponse, MemberResponse } from '../models/conversation.model';
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  UpdateMemberRequest,
} from '../dtos/conversation.dto';

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Las URLs prefirmadas se resuelven acá: el repositorio sólo trae las claves.
 *
 * Son dos caminos porque los avatares se guardan distinto: el de un usuario vive
 * como bucket+clave en su propia fila (`urlDeAvatar`, con caché en memoria), y el
 * de un grupo es un objeto de `storage_objects` — por eso pasa por
 * `storageService`, que tiene su caché de prefirmadas en la BD.
 */
async function enrichAvatarUrl(conv: ConversationResponse | null) {
  if (!conv) return conv;
  let salida = conv;

  if (conv.other_avatar_object_key) {
    const url = await urlDeAvatar(conv.other_avatar_object_key);
    if (url) salida = { ...salida, other_avatar_url: url };
  }

  if (conv.avatar_object_id) {
    try {
      salida = { ...salida, avatar_url: await storageService.getPresignedUrl(conv.avatar_object_id, null) };
    } catch (err) {
      logger.warn({ err: (err as Error).message, conversationId: conv.id }, 'Failed to resolve group avatar URL');
    }
  }
  return salida;
}

async function enrichMemberAvatarUrl(member: MemberResponse | null) {
  if (!member || !member.avatar_object_key) return member;
  const url = await urlDeAvatar(member.avatar_object_key);
  return url ? { ...member, avatar_url: url } : member;
}

class ConversationService {
  async create(userId: string, data: CreateConversationRequest) {
    // For direct chats, check if one already exists
    if (data.type === 'direct') {
      if (data.member_ids.length !== 1) {
        throw new BadRequestError('Direct conversations require exactly one other member');
      }
      const existing = await conversationRepository.findDirectBetween(userId, data.member_ids[0]);
      if (existing) return enrichAvatarUrl(toConversationResponse(existing));
    }

    const conversation = await conversationRepository.create({
      ...data,
      created_by: userId,
    });

    // Add creator as owner
    await conversationRepository.addMember(conversation.id, userId, 'owner');

    // Add other members
    for (const memberId of data.member_ids) {
      if (memberId !== userId) {
        await conversationRepository.addMember(conversation.id, memberId, 'member', userId);
      }
    }

    logger.info({ conversationId: conversation.id, type: data.type }, 'Conversation created');
    return enrichAvatarUrl(toConversationResponse(conversation));
  }

  async getById(conversationId: string, userId: string) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation');
    return enrichAvatarUrl(toConversationResponse(conversation));
  }

  async getUserConversations(userId: string, pagination?: { limit?: number; offset?: number }) {
    const conversations = await conversationRepository.findUserConversations(userId, pagination);
    return Promise.all(conversations.map(toConversationResponse).map(enrichAvatarUrl));
  }

  async update(conversationId: string, userId: string, data: UpdateConversationRequest) {
    await this._requireRole(conversationId, userId, ['owner', 'admin']);
    const conversation = await conversationRepository.update(conversationId, data);
    if (!conversation) throw new NotFoundError('Conversation');
    logger.info({ conversationId }, 'Conversation updated');
    const respuesta = toConversationResponse(conversation);
    // Nombre/descripción se ven en el header y el panel de detalle de todos
    // los miembros — sin este aviso quedan desactualizados hasta un refresh,
    // igual que pasaba con la foto antes de _avisarCambioDeAvatar.
    if (data.name !== undefined || data.description !== undefined) {
      try {
        toConversation(conversationId, 'conversation:updated', {
          id: conversationId,
          name: respuesta?.name ?? null,
          description: respuesta?.description ?? null,
        });
      } catch (err) {
        logger.warn({ err: (err as Error).message, conversationId }, 'Failed to emit conversation:updated');
      }
    }
    return respuesta;
  }

  async addMembers(conversationId: string, userId: string, memberIds: string[]) {
    await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    const results = [];
    for (const memberId of memberIds) {
      const member = await conversationRepository.addMember(conversationId, memberId, 'member', userId);
      results.push(toMemberResponse(member));
    }
    logger.info({ conversationId, added: memberIds.length }, 'Members added');
    return results;
  }

  async removeMember(conversationId: string, userId: string, targetUserId: string) {
    // Users can remove themselves; admins can remove others
    if (userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    }
    const member = await conversationRepository.removeMember(conversationId, targetUserId);
    if (!member) throw new NotFoundError('Member');
    logger.info({ conversationId, removedUser: targetUserId }, 'Member removed');
    return member;
  }

  async getMembers(
    conversationId: string,
    userId: string,
    pagination?: { limit?: number; offset?: number },
  ) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    const members = await conversationRepository.getMembers(conversationId, pagination);
    return Promise.all(members.map(toMemberResponse).map(enrichMemberAvatarUrl));
  }

  async updateMember(
    conversationId: string,
    userId: string,
    targetUserId: string,
    data: UpdateMemberRequest,
  ) {
    // Users can update their own settings (mute, pin, hide); role changes need admin
    if (data.role && userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin']);
    } else if (userId !== targetUserId) {
      await this._requireRole(conversationId, userId, ['owner', 'admin', 'moderator']);
    }
    const member = await conversationRepository.updateMember(conversationId, targetUserId, data);
    if (!member) throw new NotFoundError('Member');

    // Audit role changes (privilege escalation/demotion is security-relevant)
    if (data.role) {
      auditRepository.log({
        actor_id: userId,
        action: 'conversation.member_role_change',
        resource_type: 'conversation',
        resource_id: conversationId,
        severity: 'warning',
        category: 'content',
        data_after: { target_user_id: targetUserId, new_role: data.role },
      }).catch((err: Error) => logger.warn({ err: err.message }, 'Failed to write audit log'));
    }
    return toMemberResponse(member);
  }

  async markAsRead(conversationId: string, userId: string, messageId: string) {
    return conversationRepository.markAsRead(conversationId, userId, messageId);
  }

  /**
   * Foto de un grupo o canal. A diferencia del avatar de usuario (bucket+clave en
   * la fila del usuario), va como objeto de `storage_objects`: es a lo que apunta
   * `conversations.avatar_object_id` en el esquema.
   */
  async uploadAvatar(
    conversationId: string,
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    await this._requireRole(conversationId, userId, ['owner', 'admin']);
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation');
    if (conversation.type === 'direct') {
      // En un chat de a dos la foto es la del otro: no hay una del "chat".
      throw new BadRequestError('Direct conversations cannot have their own avatar');
    }
    if (!AVATAR_ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
    }
    if (file.size > AVATAR_MAX_SIZE) {
      throw new BadRequestError('File too large. Maximum size is 5 MB');
    }

    const objeto = (await storageService.upload(userId, file.buffer, {
      object_type: 'avatar',
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
    }))!;

    const anterior = conversation.avatar_object_id;
    const actualizada = await conversationRepository.updateAvatar(conversationId, objeto.id);
    // La foto vieja sólo se borra si ninguna otra fila la referencia.
    if (anterior) await storageService.deleteIfUnreferenced(anterior);

    await auditRepository.log({
      actor_id: userId,
      action: 'conversation.avatar_update',
      resource_type: 'conversation',
      resource_id: conversationId,
      severity: 'info',
      category: 'content',
      metadata: { mime_type: file.mimetype, size_bytes: file.size },
    });
    logger.info({ conversationId, objectId: objeto.id }, 'Conversation avatar updated');

    const respuesta = await enrichAvatarUrl(toConversationResponse(actualizada));
    this._avisarCambioDeAvatar(conversationId, respuesta);
    return respuesta;
  }

  async removeAvatar(conversationId: string, userId: string) {
    await this._requireRole(conversationId, userId, ['owner', 'admin']);
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation');

    const actualizada = await conversationRepository.updateAvatar(conversationId, null);
    if (conversation.avatar_object_id) {
      await storageService.deleteIfUnreferenced(conversation.avatar_object_id);
    }
    await auditRepository.log({
      actor_id: userId,
      action: 'conversation.avatar_remove',
      resource_type: 'conversation',
      resource_id: conversationId,
      severity: 'info',
      category: 'content',
    });

    const respuesta = toConversationResponse(actualizada);
    this._avisarCambioDeAvatar(conversationId, respuesta);
    return respuesta;
  }

  /** Los demás miembros tienen la conversación abierta: que no vean la foto vieja. */
  _avisarCambioDeAvatar(conversationId: string, respuesta: ConversationResponse | null) {
    try {
      toConversation(conversationId, 'conversation:updated', {
        id: conversationId,
        avatar_url: respuesta?.avatar_url ?? null,
        avatar_object_id: respuesta?.avatar_object_id ?? null,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, conversationId }, 'Failed to emit conversation:updated');
    }
  }

  async _requireRole(conversationId: string, userId: string, allowedRoles: string[]) {
    const member = await conversationRepository.getMember(conversationId, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');
    if (!allowedRoles.includes(member.role as string)) {
      throw new ForbiddenError('Insufficient role for this action');
    }
    return member;
  }
}

export default new ConversationService();
