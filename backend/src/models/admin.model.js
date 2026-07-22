const { toUserResponse } = require('./user.model');

function toAdminUserResponse(user, roles = [], extras = {}) {
  if (!user) return null;
  return {
    ...toUserResponse(user),
    roles: roles.map((r) => (typeof r === 'string' ? r : r.name)),
    totp_enabled: extras.totp_enabled === true,
  };
}

function toSettingResponse(row) {
  if (!row) return null;
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    category: row.category,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

function toAuditEntryResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_display_name: row.actor_display_name,
    actor_username: row.actor_username,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    ip_address: row.ip_address,
    success: row.success,
    error_message: row.error_message,
    data_before: row.data_before,
    data_after: row.data_after,
    severity: row.severity || 'info',
    category: row.category || 'system',
    session_id: row.session_id,
    duration_ms: row.duration_ms,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

function toStorageObjectAdminResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    bucket_name: row.bucket_name,
    object_key: row.object_key,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size_bytes: parseInt(row.file_size_bytes, 10) || 0,
    object_type: row.object_type,
    processing_status: row.processing_status,
    virus_scan_status: row.virus_scan_status,
    uploader_id: row.uploader_id,
    uploader_display_name: row.uploader_display_name,
    uploaded_at: row.uploaded_at,
  };
}

module.exports = {
  toAdminUserResponse,
  toSettingResponse,
  toAuditEntryResponse,
  toStorageObjectAdminResponse,
};
