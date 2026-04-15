function toUserResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    phone_extension: row.phone_extension,
    department: row.department,
    job_title: row.job_title,
    avatar_bucket: row.avatar_bucket,
    avatar_object_key: row.avatar_object_key,
    status: row.status,
    presence: row.presence,
    presence_message: row.presence_message,
    last_seen_at: row.last_seen_at,
    timezone: row.timezone,
    locale: row.locale,
    created_at: row.created_at,
  };
}

function toUserMinimal(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_bucket: row.avatar_bucket,
    avatar_object_key: row.avatar_object_key,
    presence: row.presence,
  };
}

module.exports = { toUserResponse, toUserMinimal };
