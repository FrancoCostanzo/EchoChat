/**
 * Contrato de /conversations. Fuente de verdad en el backend:
 * backend/src/models/conversation.model.ts (toConversationResponse,
 * toMemberResponse) y backend/src/dtos/conversation.dto.ts (requests). Ver la
 * nota de sincronización en types/user.ts.
 */
export type ConversationType = 'direct' | 'group' | 'channel' | 'broadcast' | 'bot';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';
export interface ConversationResponse {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  avatar_object_id: string | null;
  topic: string | null;
  is_archived: boolean;
  is_read_only: boolean;
  is_discoverable: boolean;
  max_members: number | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Datos del miembro actual, presentes cuando la fila viene de un JOIN con
  // conversation_members (listado "mis conversaciones").
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  member_role: string | null;
  // Conversación directa: datos del otro usuario.
  other_user_id: string | null;
  display_name: string | null;
  other_username: string | null;
  member_presence: string | null;
  /** Mensaje de ausencia del otro lado en un chat directo. */
  member_presence_message: string | null;
  other_avatar_object_key: string | null;
  other_avatar_url: string | null;
  // Preview del último mensaje.
  last_message_body: string | null;
  last_message_type: string | null;
  last_message_metadata: unknown;
}

export interface MemberResponse {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  is_pinned: boolean;
  joined_at: string | null;
  // Datos de usuario, presentes cuando la fila viene de un JOIN con users.
  username?: string | null;
  display_name?: string | null;
  avatar_object_key?: string | null;
  presence?: string | null;
}

export interface CreateConversationRequest {
  type: ConversationType;
  /** Obligatorio para 'group' y 'channel'. */
  name?: string | null;
  description?: string | null;
  topic?: string | null;
  is_discoverable?: boolean;
  max_members?: number | null;
  member_ids: string[];
}

export interface UpdateConversationRequest {
  name?: string;
  description?: string | null;
  topic?: string | null;
  is_archived?: boolean;
  is_read_only?: boolean;
  is_discoverable?: boolean;
  max_members?: number | null;
}

export interface AddMembersRequest {
  member_ids: string[];
}

export interface UpdateMemberRequest {
  role?: MemberRole;
  is_muted?: boolean;
  muted_until?: string | null;
  is_pinned?: boolean;
  is_hidden?: boolean;
}
