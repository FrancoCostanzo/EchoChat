function toMessageResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    type: row.type,
    body: row.body,
    body_format: row.body_format,
    reply_to_id: row.reply_to_id,
    reply_to_body: row.reply_to_body ?? null,
    reply_to_type: row.reply_to_type ?? null,
    reply_to_sender: row.reply_to_sender ?? null,
    thread_id: row.thread_id,
    forwarded_from_id: row.forwarded_from_id,
    is_edited: row.is_edited,
    edited_at: row.edited_at,
    is_deleted: row.is_deleted,
    link_preview: row.link_preview,
    metadata: row.metadata,
    sent_at: row.sent_at,
    // Optionally joined sender info
    sender_username: row.sender_username,
    sender_display_name: row.sender_display_name,
    sender_avatar_key: row.sender_avatar_key,
    // Attachments array if joined
    attachments: row.attachments ?? [],
    // Reactions summary if joined
    reactions: row.reactions ?? [],
    // Read receipt counts (sent → delivered → read)
    delivered_count: parseInt(row.delivered_count, 10) || 0,
    read_count: parseInt(row.read_count, 10) || 0,
  };
}

function toSavedMessageResponse(row) {
  if (!row) return null;
  return {
    ...toMessageResponse(row),
    saved_note: row.saved_note ?? null,
    saved_at: row.saved_at,
    conversation_name: row.conversation_name ?? null,
    conversation_type: row.conversation_type ?? null,
  };
}

function toDraftResponse(row) {
  if (!row) return null;
  return {
    conversation_id: row.conversation_id,
    body: row.body,
    reply_to_id: row.reply_to_id,
    pending_attachments: row.pending_attachments ?? [],
    updated_at: row.updated_at,
  };
}

module.exports = { toMessageResponse, toSavedMessageResponse, toDraftResponse };
