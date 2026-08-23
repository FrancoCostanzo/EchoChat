import type { Row } from '../types/rows';

// Channel = conversation (type 'channel') + channel_settings. This response
// merges both for the discovery/detail views.

/** La consulta puede venir desde `conversations` o desde `channel_settings`. */
export type ChannelRow = Partial<Row<'conversations'>> & Partial<Row<'channel_settings'>> & {
  /** COUNT(): pg devuelve los bigint como string. */
  member_count?: string | number | null;
  is_member?: boolean | null;
  member_role?: string | null;
  has_pending_request?: boolean | null;
};

export type JoinRequestRow = Row<'channel_join_requests'> & {
  username?: string | null;
  display_name?: string | null;
  avatar_object_key?: string | null;
  department?: string | null;
};

export function toChannelResponse(row: ChannelRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id ?? row.conversation_id,
    name: row.name,
    description: row.description,
    topic: row.topic,
    avatar_object_id: row.avatar_object_id ?? null,
    max_members: row.max_members ?? null,
    category: row.category ?? null,
    is_official: row.is_official ?? false,
    member_count: row.member_count != null ? parseInt(String(row.member_count), 10) : 0,
    post_restriction: row.post_restriction ?? 'members',
    join_mode: row.join_mode ?? 'open',
    is_member: row.is_member ?? undefined,
    member_role: row.member_role ?? undefined,
    has_pending_request: row.has_pending_request ?? undefined,
    created_at: row.created_at,
  };
}

export function toJoinRequestResponse(row: JoinRequestRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    message: row.message,
    status: row.status,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    created_at: row.created_at,
    // User data when joined
    username: row.username,
    display_name: row.display_name,
    avatar_object_key: row.avatar_object_key,
    department: row.department,
  };
}

export type ChannelResponse = NonNullable<ReturnType<typeof toChannelResponse>>;
export type JoinRequestResponse = NonNullable<ReturnType<typeof toJoinRequestResponse>>;
