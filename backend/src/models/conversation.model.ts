import type { Row } from '../types/rows';

/**
 * Fila de conversación con las columnas que agregan los JOINs de
 * `conversationRepository`. Declararlas acá documenta qué tiene que traer la
 * consulta: hasta ahora eso sólo se sabía leyendo el SQL.
 */
export type ConversationRow = Row<'conversations'> & {
  /** COUNT(): pg devuelve los bigint como string. */
  unread_count?: string | null;
  is_muted?: boolean | null;
  is_pinned?: boolean | null;
  member_role?: string | null;
  role?: string | null;
  other_user_id?: string | null;
  other_display_name?: string | null;
  other_username?: string | null;
  member_presence?: string | null;
  member_presence_message?: string | null;
  other_avatar_object_key?: string | null;
  other_avatar_url?: string | null;
  last_message_body?: string | null;
  last_message_type?: string | null;
  last_message_metadata?: unknown;
};

export type MemberRow = Row<'conversation_members'> & {
  username?: string | null;
  display_name?: string | null;
  avatar_object_key?: string | null;
  presence?: string | null;
};

export function toConversationResponse(row: ConversationRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    avatar_object_id: row.avatar_object_id,
    // Foto del grupo/canal ya firmada; la resuelve conversationService.
    avatar_url: null as string | null,
    topic: row.topic,
    is_archived: row.is_archived,
    is_read_only: row.is_read_only,
    is_discoverable: row.is_discoverable,
    only_admins_edit_info: row.only_admins_edit_info,
    max_members: row.max_members,
    created_by: row.created_by,
    last_message_at: row.last_message_at,
    last_message_id: row.last_message_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Joined from conversation_members if present
    unread_count: row.unread_count != null ? parseInt(row.unread_count, 10) : 0,
    is_muted: row.is_muted ?? false,
    is_pinned: row.is_pinned ?? false,
    member_role: row.member_role ?? row.role ?? null,
    // Direct conversation: other member info
    other_user_id: row.other_user_id ?? null,
    display_name: row.other_display_name ?? null,
    other_username: row.other_username ?? null,
    member_presence: row.member_presence ?? null,
    member_presence_message: row.member_presence_message ?? null,
    other_avatar_object_key: row.other_avatar_object_key ?? null,
    other_avatar_url: row.other_avatar_url ?? null,
    // Last message preview
    last_message_body: row.last_message_body ?? null,
    last_message_type: row.last_message_type ?? null,
    last_message_metadata: row.last_message_metadata ?? null,
  };
}

export function toMemberResponse(row: MemberRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    is_muted: row.is_muted,
    is_pinned: row.is_pinned,
    joined_at: row.joined_at,
    // User data if joined
    username: row.username,
    display_name: row.display_name,
    avatar_object_key: row.avatar_object_key,
    // La URL prefirmada la resuelve `conversationService` (enrichMemberAvatarUrl);
    // declararla acá es lo que hace que el cliente sepa que existe.
    avatar_url: null as string | null,
    presence: row.presence,
  };
}

export type ConversationResponse = NonNullable<ReturnType<typeof toConversationResponse>>;
export type MemberResponse = NonNullable<ReturnType<typeof toMemberResponse>>;
