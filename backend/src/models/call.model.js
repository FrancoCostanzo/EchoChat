function toCallResponse(row) {
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

function toCallParticipantResponse(row) {
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

module.exports = { toCallResponse, toCallParticipantResponse };
