import type { Row } from '../types/rows';

export type CallRow = Row<'calls'> & { participants?: unknown[] | null };

/** Fila del historial global: trae datos de la conversación y del otro usuario. */
export type CallHistoryRow = Row<'calls'> & {
  conversation_type?: string | null;
  conversation_name?: string | null;
  other_display_name?: string | null;
  other_avatar_key?: string | null;
};

export function toCallResponse(row: CallRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    type: row.type,
    status: row.status,
    initiated_by: row.initiated_by,
    initiated_at: row.initiated_at,
    answered_at: row.answered_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    end_reason: row.end_reason,
    is_encrypted: row.is_encrypted,
    participants: row.participants ?? [],
    created_at: row.created_at,
  };
}

export function toCallParticipantResponse(row: Row<'call_participants'> | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    call_id: row.call_id,
    user_id: row.user_id,
    status: row.status,
    can_speak: row.can_speak,
    can_video: row.can_video,
    can_share_screen: row.can_share_screen,
    is_muted_by_host: row.is_muted_by_host,
    joined_at: row.joined_at,
    left_at: row.left_at,
  };
}

// Fila del historial global: aplana el nombre a mostrar (el otro usuario en
// directos, el nombre del grupo/canal en el resto).
export function toCallHistoryItem(row: CallHistoryRow | null | undefined) {
  if (!row) return null;
  const isDirect = row.conversation_type === 'direct';
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    conversation_type: row.conversation_type,
    type: row.type,
    status: row.status,
    initiated_by: row.initiated_by,
    initiated_at: row.initiated_at,
    answered_at: row.answered_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    end_reason: row.end_reason,
    display_name: isDirect ? (row.other_display_name ?? null) : (row.conversation_name ?? null),
    avatar_key: isDirect ? (row.other_avatar_key ?? null) : null,
  };
}

export type CallResponse = NonNullable<ReturnType<typeof toCallResponse>>;
export type CallParticipantResponse = NonNullable<ReturnType<typeof toCallParticipantResponse>>;
export type CallHistoryItem = NonNullable<ReturnType<typeof toCallHistoryItem>>;
