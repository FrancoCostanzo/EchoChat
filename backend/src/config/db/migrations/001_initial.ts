// Esquema inicial completo: equivale al schema .sql histórico + las migraciones
// 003–024. Generado desde el catálogo de PostgreSQL (docs/MULTI_DB.md, etapa 1)
// y verificado contra pg_dump. Los cambios nuevos van en migraciones 002+.
import { sql, type Kysely } from 'kysely';
import { t, d, onPostgres } from '../schema';

export async function up(db: Kysely<any>): Promise<void> {
  await onPostgres(db, async (db) => {
    await sql.raw("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"").execute(db);
    await sql.raw("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"").execute(db);
    await sql.raw("CREATE EXTENSION IF NOT EXISTS \"pg_trgm\"").execute(db);
    await sql.raw("CREATE EXTENSION IF NOT EXISTS \"btree_gin\"").execute(db);
  });

  await db.schema.createTable("users")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("username", t.varchar(50), (c) => c.notNull())
    .addColumn("display_name", t.varchar(100), (c) => c.notNull())
    .addColumn("email", t.varchar(255))
    .addColumn("phone_extension", t.varchar(20))
    .addColumn("department", t.varchar(100))
    .addColumn("job_title", t.varchar(100))
    .addColumn("avatar_bucket", t.varchar(100), (c) => c.defaultTo("messaging-avatars"))
    .addColumn("avatar_object_key", t.varchar(500))
    .addColumn("status", t.varchar(20), (c) => c.defaultTo("active"))
    .addColumn("presence", t.varchar(20), (c) => c.defaultTo("offline"))
    .addColumn("presence_message", t.varchar(200))
    .addColumn("last_seen_at", t.timestamptz())
    .addColumn("timezone", t.varchar(50), (c) => c.defaultTo("America/Argentina/Cordoba"))
    .addColumn("locale", t.varchar(10), (c) => c.defaultTo("es-AR"))
    .addColumn("auth_provider", t.varchar(20), (c) => c.notNull().defaultTo("local"))
    .addColumn("external_id", t.varchar(255))
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("away_until", t.timestamptz())
    .addColumn("auto_reply_enabled", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addCheckConstraint("users_auth_provider_check", sql.raw("auth_provider IN ('local', 'ldap', 'oidc', 'saml', 'scim')"))
    .addUniqueConstraint("users_email_key", ["email"])
    .addPrimaryKeyConstraint("users_pkey", ["id"])
    .addCheckConstraint("users_presence_check", sql.raw("presence IN ('online', 'offline', 'away', 'busy', 'dnd')"))
    .addCheckConstraint("users_status_check", sql.raw("status IN ('active', 'inactive', 'suspended', 'deleted')"))
    .addUniqueConstraint("users_username_key", ["username"])
    .execute();

  await db.schema.createTable("user_credentials")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("password_hash", t.text(), (c) => c.notNull())
    .addColumn("must_change_pw", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("pw_changed_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("failed_attempts", t.integer(), (c) => c.defaultTo(0))
    .addColumn("locked_until", t.timestamptz())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("totp_secret", t.text())
    .addColumn("totp_enabled", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addColumn("totp_backup_codes", t.array('text'), (c) => c.notNull().defaultTo("{}"))
    .addPrimaryKeyConstraint("user_credentials_pkey", ["user_id"])
    .execute();

  await db.schema.createTable("user_sessions")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("token_hash", t.text(), (c) => c.notNull())
    .addColumn("device_name", t.varchar(100))
    .addColumn("device_type", t.varchar(20))
    .addColumn("ip_address", t.ip())
    .addColumn("user_agent", t.text())
    .addColumn("is_active", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("expires_at", t.timestamptz(), (c) => c.notNull())
    .addColumn("last_activity", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("user_sessions_device_type_check", sql.raw("device_type IN ('web', 'desktop', 'mobile', 'api')"))
    .addPrimaryKeyConstraint("user_sessions_pkey", ["id"])
    .addUniqueConstraint("user_sessions_token_hash_key", ["token_hash"])
    .execute();

  await db.schema.createTable("roles")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("name", t.varchar(50), (c) => c.notNull())
    .addColumn("display_name", t.varchar(100), (c) => c.notNull())
    .addColumn("description", t.text())
    .addColumn("is_system", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("priority", t.integer(), (c) => c.defaultTo(0))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addUniqueConstraint("roles_name_key", ["name"])
    .addPrimaryKeyConstraint("roles_pkey", ["id"])
    .execute();

  await db.schema.createTable("permissions")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("code", t.varchar(100), (c) => c.notNull())
    .addColumn("category", t.varchar(50), (c) => c.notNull())
    .addColumn("description", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addUniqueConstraint("permissions_code_key", ["code"])
    .addPrimaryKeyConstraint("permissions_pkey", ["id"])
    .execute();

  await db.schema.createTable("role_permissions")
    .addColumn("role_id", t.uuid(), (c) => c.notNull())
    .addColumn("permission_id", t.uuid(), (c) => c.notNull())
    .addPrimaryKeyConstraint("role_permissions_pkey", ["role_id", "permission_id"])
    .execute();

  await db.schema.createTable("user_roles")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("role_id", t.uuid(), (c) => c.notNull())
    .addColumn("granted_by", t.uuid())
    .addColumn("granted_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("expires_at", t.timestamptz())
    .addPrimaryKeyConstraint("user_roles_pkey", ["user_id", "role_id"])
    .execute();

  await db.schema.createTable("storage_objects")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("uploader_id", t.uuid())
    .addColumn("bucket_name", t.varchar(100), (c) => c.notNull())
    .addColumn("object_key", t.varchar(1000), (c) => c.notNull())
    .addColumn("original_filename", t.varchar(500), (c) => c.notNull())
    .addColumn("mime_type", t.varchar(100), (c) => c.notNull())
    .addColumn("file_size_bytes", t.bigint(), (c) => c.notNull())
    .addColumn("file_hash_sha256", t.varchar(64))
    .addColumn("object_type", t.varchar(20), (c) => c.notNull())
    .addColumn("image_width", t.integer())
    .addColumn("image_height", t.integer())
    .addColumn("duration_ms", t.integer())
    .addColumn("page_count", t.integer())
    .addColumn("thumbnail_bucket", t.varchar(100), (c) => c.defaultTo("messaging-thumbnails"))
    .addColumn("thumbnail_key", t.varchar(1000))
    .addColumn("processing_status", t.varchar(20), (c) => c.defaultTo("pending"))
    .addColumn("processing_error", t.text())
    .addColumn("processed_at", t.timestamptz())
    .addColumn("virus_scan_status", t.varchar(20), (c) => c.defaultTo("pending"))
    .addColumn("virus_scanned_at", t.timestamptz())
    .addColumn("exif_stripped", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("access_policy", t.varchar(20), (c) => c.defaultTo("private"))
    .addColumn("expires_at", t.timestamptz())
    .addColumn("etag", t.varchar(100))
    .addColumn("extra_metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("uploaded_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("storage_objects_access_policy_check", sql.raw("access_policy IN ('private', 'public')"))
    .addUniqueConstraint("storage_objects_bucket_name_object_key_key", ["bucket_name", "object_key"])
    .addCheckConstraint("storage_objects_object_type_check", sql.raw("object_type IN ('image', 'video', 'audio', 'voice', 'document', 'thumbnail', 'recording', 'sticker', 'avatar', 'gif', 'other', 'wallpaper')"))
    .addPrimaryKeyConstraint("storage_objects_pkey", ["id"])
    .addCheckConstraint("storage_objects_processing_status_check", sql.raw("processing_status IN ('pending', 'processing', 'ready', 'failed')"))
    .addCheckConstraint("storage_objects_virus_scan_status_check", sql.raw("virus_scan_status IN ('pending', 'clean', 'infected', 'error', 'skipped')"))
    .execute();

  await db.schema.createTable("storage_presigned_urls")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("object_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid())
    .addColumn("operation", t.varchar(10), (c) => c.defaultTo("get"))
    .addColumn("presigned_url", t.text(), (c) => c.notNull())
    .addColumn("expires_at", t.timestamptz(), (c) => c.notNull())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addUniqueConstraint("storage_presigned_urls_object_id_user_id_operation_key", ["object_id", "user_id", "operation"])
    .addCheckConstraint("storage_presigned_urls_operation_check", sql.raw("operation IN ('get', 'put', 'delete')"))
    .addPrimaryKeyConstraint("storage_presigned_urls_pkey", ["id"])
    .execute();

  await db.schema.createTable("conversations")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("type", t.varchar(20), (c) => c.notNull())
    .addColumn("name", t.varchar(200))
    .addColumn("description", t.text())
    .addColumn("avatar_object_id", t.uuid())
    .addColumn("topic", t.varchar(300))
    .addColumn("is_archived", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("is_read_only", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("is_discoverable", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("max_members", t.integer())
    .addColumn("created_by", t.uuid())
    .addColumn("last_message_at", t.timestamptz())
    .addColumn("last_message_id", t.uuid())
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("only_admins_edit_info", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addPrimaryKeyConstraint("conversations_pkey", ["id"])
    .addCheckConstraint("conversations_type_check", sql.raw("type IN ('direct', 'group', 'channel', 'broadcast', 'bot')"))
    .execute();

  await db.schema.createTable("conversation_members")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("role", t.varchar(30), (c) => c.defaultTo("member"))
    .addColumn("is_muted", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("muted_until", t.timestamptz())
    .addColumn("is_pinned", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("is_hidden", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("last_read_at", t.timestamptz())
    .addColumn("last_read_msg_id", t.uuid())
    .addColumn("custom_permissions", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("invited_by", t.uuid())
    .addColumn("joined_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("left_at", t.timestamptz())
    .addColumn("notification_level", t.varchar(10), (c) => c.notNull().defaultTo("all"))
    .addColumn("unread_email_at", t.timestamptz())
    .addUniqueConstraint("conversation_members_conversation_id_user_id_key", ["conversation_id", "user_id"])
    .addCheckConstraint("conversation_members_notification_level_check", sql.raw("notification_level IN ('all', 'mentions', 'none')"))
    .addPrimaryKeyConstraint("conversation_members_pkey", ["id"])
    .addCheckConstraint("conversation_members_role_check", sql.raw("role IN ('owner', 'admin', 'moderator', 'member', 'viewer')"))
    .execute();

  await db.schema.createTable("conversation_events")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("actor_id", t.uuid())
    .addColumn("event_type", t.varchar(50), (c) => c.notNull())
    .addColumn("target_user_id", t.uuid())
    .addColumn("data", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("conversation_events_pkey", ["id"])
    .execute();

  await db.schema.createTable("messages")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("sender_id", t.uuid())
    .addColumn("type", t.varchar(30), (c) => c.defaultTo("text"))
    .addColumn("body", t.text())
    .addColumn("body_format", t.varchar(20), (c) => c.defaultTo("plain"))
    .addColumn("reply_to_id", t.uuid())
    .addColumn("thread_id", t.uuid())
    .addColumn("forwarded_from_id", t.uuid())
    .addColumn("forwarded_from_conv", t.uuid())
    .addColumn("is_edited", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("edited_at", t.timestamptz())
    .addColumn("is_deleted", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("deleted_at", t.timestamptz())
    .addColumn("deleted_by", t.uuid())
    .addColumn("system_data", t.json())
    .addColumn("link_preview", t.json())
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("sent_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("messages_body_format_check", sql.raw("body_format IN ('plain', 'markdown', 'html')"))
    .addPrimaryKeyConstraint("messages_pkey", ["id"])
    .addCheckConstraint("messages_type_check", sql.raw("type IN ('text', 'media', 'location', 'contact', 'system', 'poll', 'forwarded', 'deleted_placeholder', 'code', 'sticker', 'game')"))
    .execute();

  await db.schema.createTable("message_edits")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("body_before", t.text(), (c) => c.notNull())
    .addColumn("edited_by", t.uuid(), (c) => c.notNull())
    .addColumn("edited_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("message_edits_pkey", ["id"])
    .execute();

  await db.schema.createTable("message_search_tokens")
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("token", t.text(), (c) => c.notNull())
    .addPrimaryKeyConstraint("message_search_tokens_pkey", ["message_id", "token"])
    .execute();

  await db.schema.createTable("message_receipts")
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("delivered_at", t.timestamptz())
    .addColumn("read_at", t.timestamptz())
    .addPrimaryKeyConstraint("message_receipts_pkey", ["message_id", "user_id"])
    .execute();

  await db.schema.createTable("message_reactions")
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("emoji", t.varchar(10), (c) => c.notNull())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("message_reactions_pkey", ["message_id", "user_id", "emoji"])
    .execute();

  await db.schema.createTable("saved_messages")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("note", t.text())
    .addColumn("saved_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("saved_messages_pkey", ["user_id", "message_id"])
    .execute();

  await db.schema.createTable("pinned_messages")
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("pinned_by", t.uuid(), (c) => c.notNull())
    .addColumn("pinned_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("pinned_messages_pkey", ["conversation_id", "message_id"])
    .execute();

  await db.schema.createTable("drafts")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("body", t.text())
    .addColumn("reply_to_id", t.uuid())
    .addColumn("pending_attachments", t.json(), (c) => c.defaultTo("[]"))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("drafts_pkey", ["user_id", "conversation_id"])
    .execute();

  await db.schema.createTable("message_attachments")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("object_id", t.uuid(), (c) => c.notNull())
    .addColumn("sort_order", t.integer(), (c) => c.defaultTo(0))
    .addColumn("caption", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("message_attachments_pkey", ["id"])
    .execute();

  await db.schema.createTable("calls")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid())
    .addColumn("type", t.varchar(20), (c) => c.notNull())
    .addColumn("status", t.varchar(20), (c) => c.defaultTo("pending"))
    .addColumn("initiated_by", t.uuid(), (c) => c.notNull())
    .addColumn("initiated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("answered_at", t.timestamptz())
    .addColumn("ended_at", t.timestamptz())
    .addColumn("duration_seconds", t.integer())
    .addColumn("end_reason", t.varchar(30))
    .addColumn("server_host", t.varchar(255))
    .addColumn("room_id", t.varchar(255))
    .addColumn("is_encrypted", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("quality_stats", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("calls_pkey", ["id"])
    .addCheckConstraint("calls_status_check", sql.raw("status IN ('pending', 'ringing', 'active', 'ended', 'missed', 'rejected', 'failed')"))
    .addCheckConstraint("calls_type_check", sql.raw("type IN ('voice', 'video', 'screen_share', 'conference')"))
    .execute();

  await db.schema.createTable("call_participants")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("call_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("status", t.varchar(20), (c) => c.defaultTo("invited"))
    .addColumn("can_speak", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("can_video", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("can_share_screen", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("is_muted_by_host", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("invited_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("joined_at", t.timestamptz())
    .addColumn("left_at", t.timestamptz())
    .addColumn("avg_packet_loss", t.numeric(5, 2))
    .addColumn("avg_latency_ms", t.integer())
    .addUniqueConstraint("call_participants_call_id_user_id_key", ["call_id", "user_id"])
    .addPrimaryKeyConstraint("call_participants_pkey", ["id"])
    .addCheckConstraint("call_participants_status_check", sql.raw("status IN ('invited', 'ringing', 'joined', 'left', 'rejected', 'no_answer', 'busy')"))
    .execute();

  await db.schema.createTable("call_recordings")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("call_id", t.uuid(), (c) => c.notNull())
    .addColumn("object_id", t.uuid(), (c) => c.notNull())
    .addColumn("started_by", t.uuid())
    .addColumn("consented_by", t.array('uuid'))
    .addColumn("started_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("ended_at", t.timestamptz())
    .addColumn("is_available", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("call_recordings_pkey", ["id"])
    .execute();

  await db.schema.createTable("broadcast_lists")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("name", t.varchar(200), (c) => c.notNull())
    .addColumn("description", t.text())
    .addColumn("owner_id", t.uuid(), (c) => c.notNull())
    .addColumn("is_active", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("broadcast_lists_pkey", ["id"])
    .execute();

  await db.schema.createTable("broadcast_recipients")
    .addColumn("broadcast_list_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("added_by", t.uuid())
    .addColumn("added_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("broadcast_recipients_pkey", ["broadcast_list_id", "user_id"])
    .execute();

  await db.schema.createTable("broadcast_messages")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("broadcast_list_id", t.uuid(), (c) => c.notNull())
    .addColumn("sender_id", t.uuid(), (c) => c.notNull())
    .addColumn("body", t.text())
    .addColumn("type", t.varchar(20), (c) => c.defaultTo("text"))
    .addColumn("object_id", t.uuid())
    .addColumn("scheduled_at", t.timestamptz())
    .addColumn("sent_at", t.timestamptz())
    .addColumn("status", t.varchar(20), (c) => c.defaultTo("draft"))
    .addColumn("total_recipients", t.integer(), (c) => c.defaultTo(0))
    .addColumn("total_delivered", t.integer(), (c) => c.defaultTo(0))
    .addColumn("total_read", t.integer(), (c) => c.defaultTo(0))
    .addColumn("metadata", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("broadcast_messages_pkey", ["id"])
    .addCheckConstraint("broadcast_messages_status_check", sql.raw("status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')"))
    .addCheckConstraint("broadcast_messages_type_check", sql.raw("type IN ('text', 'media', 'template')"))
    .execute();

  await db.schema.createTable("broadcast_deliveries")
    .addColumn("broadcast_msg_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("conversation_id", t.uuid())
    .addColumn("delivered_at", t.timestamptz())
    .addColumn("read_at", t.timestamptz())
    .addPrimaryKeyConstraint("broadcast_deliveries_pkey", ["broadcast_msg_id", "user_id"])
    .execute();

  await db.schema.createTable("channel_settings")
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("category", t.varchar(50))
    .addColumn("is_official", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("member_count", t.integer(), (c) => c.defaultTo(0))
    .addColumn("post_restriction", t.varchar(20), (c) => c.defaultTo("members"))
    .addColumn("join_mode", t.varchar(20), (c) => c.defaultTo("open"))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("channel_settings_join_mode_check", sql.raw("join_mode IN ('open', 'invite_only', 'request')"))
    .addPrimaryKeyConstraint("channel_settings_pkey", ["conversation_id"])
    .addCheckConstraint("channel_settings_post_restriction_check", sql.raw("post_restriction IN ('members', 'admins_only', 'owner_only')"))
    .execute();

  await db.schema.createTable("channel_join_requests")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("message", t.text())
    .addColumn("status", t.varchar(20), (c) => c.defaultTo("pending"))
    .addColumn("reviewed_by", t.uuid())
    .addColumn("reviewed_at", t.timestamptz())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("channel_join_requests_pkey", ["id"])
    .addCheckConstraint("channel_join_requests_status_check", sql.raw("status IN ('pending', 'approved', 'rejected')"))
    .execute();

  await db.schema.createTable("polls")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("question", t.text(), (c) => c.notNull())
    .addColumn("is_anonymous", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("is_multiple", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("closes_at", t.timestamptz())
    .addColumn("is_closed", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("polls_pkey", ["id"])
    .execute();

  await db.schema.createTable("poll_options")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("poll_id", t.uuid(), (c) => c.notNull())
    .addColumn("text", t.varchar(300), (c) => c.notNull())
    .addColumn("sort_order", t.integer(), (c) => c.defaultTo(0))
    .addColumn("vote_count", t.integer(), (c) => c.defaultTo(0))
    .addPrimaryKeyConstraint("poll_options_pkey", ["id"])
    .execute();

  await db.schema.createTable("poll_votes")
    .addColumn("poll_id", t.uuid(), (c) => c.notNull())
    .addColumn("option_id", t.uuid(), (c) => c.notNull())
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("voted_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("poll_votes_pkey", ["poll_id", "option_id", "user_id"])
    .execute();

  await db.schema.createTable("notifications")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("recipient_id", t.uuid(), (c) => c.notNull())
    .addColumn("type", t.varchar(50), (c) => c.notNull())
    .addColumn("title", t.varchar(200))
    .addColumn("body", t.text())
    .addColumn("reference_type", t.varchar(30))
    .addColumn("reference_id", t.uuid())
    .addColumn("reference_data", t.json(), (c) => c.defaultTo("{}"))
    .addColumn("is_read", t.boolean(), (c) => c.defaultTo(false))
    .addColumn("read_at", t.timestamptz())
    .addColumn("channel", t.varchar(20), (c) => c.defaultTo("in_app"))
    .addColumn("delivered_at", t.timestamptz())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("email_due_at", t.timestamptz())
    .addColumn("emailed_at", t.timestamptz())
    .addCheckConstraint("notifications_channel_check", sql.raw("channel IN ('in_app', 'push', 'email', 'sms')"))
    .addPrimaryKeyConstraint("notifications_pkey", ["id"])
    .execute();

  await db.schema.createTable("notification_preferences")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("event_type", t.varchar(50), (c) => c.notNull())
    .addColumn("in_app_enabled", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("push_enabled", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("email_enabled", t.boolean(), (c) => c.defaultTo(false))
    .addPrimaryKeyConstraint("notification_preferences_pkey", ["user_id", "event_type"])
    .execute();

  await db.schema.createTable("user_relationships")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("target_user_id", t.uuid(), (c) => c.notNull())
    .addColumn("type", t.varchar(20), (c) => c.notNull())
    .addColumn("alias", t.varchar(100))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("user_relationships_check", sql.raw("(user_id <> target_user_id)"))
    .addPrimaryKeyConstraint("user_relationships_pkey", ["id"])
    .addCheckConstraint("user_relationships_type_check", sql.raw("type IN ('contact', 'blocked', 'favorite')"))
    .addUniqueConstraint("user_relationships_user_id_target_user_id_type_key", ["user_id", "target_user_id", "type"])
    .execute();

  await db.schema.createTable("audit_log")
    .addColumn("id", t.bigserial(), (c) => c.notNull())
    .addColumn("actor_id", t.uuid())
    .addColumn("action", t.varchar(100), (c) => c.notNull())
    .addColumn("resource_type", t.varchar(50))
    .addColumn("resource_id", t.uuid())
    .addColumn("ip_address", t.ip())
    .addColumn("user_agent", t.text())
    .addColumn("data_before", t.json())
    .addColumn("data_after", t.json())
    .addColumn("success", t.boolean(), (c) => c.defaultTo(true))
    .addColumn("error_message", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("severity", t.varchar(10), (c) => c.defaultTo("info"))
    .addColumn("category", t.varchar(50), (c) => c.defaultTo("system"))
    .addColumn("session_id", t.uuid())
    .addColumn("duration_ms", t.integer())
    .addColumn("metadata", t.json())
    .addPrimaryKeyConstraint("audit_log_pkey", ["id"])
    .execute();

  await db.schema.createTable("system_settings")
    .addColumn("key", t.varchar(100), (c) => c.notNull())
    .addColumn("value", t.json(), (c) => c.notNull())
    .addColumn("description", t.text())
    .addColumn("category", t.varchar(50))
    .addColumn("updated_by", t.uuid())
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("system_settings_pkey", ["key"])
    .execute();

  await db.schema.createTable("games")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("kind", t.varchar(20), (c) => c.notNull())
    .addColumn("player1_id", t.uuid(), (c) => c.notNull())
    .addColumn("player2_id", t.uuid(), (c) => c.notNull())
    .addColumn("state", t.json(), (c) => c.notNull().defaultTo("{}"))
    .addColumn("status", t.varchar(20), (c) => c.notNull().defaultTo("active"))
    .addColumn("winner_id", t.uuid())
    .addColumn("result", t.varchar(20))
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addCheckConstraint("games_kind_check", sql.raw("kind IN ('tictactoe', 'rps', 'hangman')"))
    .addPrimaryKeyConstraint("games_pkey", ["id"])
    .addCheckConstraint("games_result_check", sql.raw("result IN ('win', 'draw')"))
    .addCheckConstraint("games_status_check", sql.raw("status IN ('active', 'finished')"))
    .execute();

  await db.schema.createTable("user_wallpapers")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("scope", t.varchar(20), (c) => c.notNull())
    .addColumn("scope_key", t.varchar(100), (c) => c.notNull())
    .addColumn("wallpaper_type", t.varchar(20), (c) => c.notNull())
    .addColumn("wallpaper_value", t.varchar(200))
    .addColumn("storage_object_id", t.uuid())
    .addColumn("created_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.defaultTo(d.now()))
    .addPrimaryKeyConstraint("user_wallpapers_pkey", ["user_id", "scope", "scope_key"])
    .addCheckConstraint("user_wallpapers_scope_check", sql.raw("scope IN ('global', 'type', 'conversation')"))
    .addCheckConstraint("user_wallpapers_wallpaper_type_check", sql.raw("wallpaper_type IN ('preset', 'color', 'image')"))
    .execute();

  await db.schema.createTable("monitoring_snapshots")
    .addColumn("id", t.bigserial(), (c) => c.notNull())
    .addColumn("host", t.varchar(255), (c) => c.notNull())
    .addColumn("proceso_inicio", t.timestamptz(), (c) => c.notNull())
    .addColumn("heap_pct", t.smallint())
    .addColumn("mem_sistema_pct", t.smallint())
    .addColumn("cpu_proceso_pct", t.numeric(5, 2))
    .addColumn("latencia_db_ms", t.numeric(10, 2))
    .addColumn("pool_ocupadas", t.smallint())
    .addColumn("pool_max", t.smallint())
    .addColumn("qps", t.numeric(10, 2))
    .addColumn("requests_por_min", t.integer())
    .addColumn("error_rate_pct", t.numeric(5, 2))
    .addColumn("fecha_registro", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("monitoring_snapshots_pkey", ["id"])
    .execute();

  await db.schema.createTable("sticker_packs")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("owner_id", t.uuid(), (c) => c.notNull())
    .addColumn("name", t.varchar(80), (c) => c.notNull())
    .addColumn("position", t.integer(), (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("sticker_packs_pkey", ["id"])
    .execute();

  await db.schema.createTable("user_stickers")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("owner_id", t.uuid(), (c) => c.notNull())
    .addColumn("storage_object_id", t.uuid(), (c) => c.notNull())
    .addColumn("pack_id", t.uuid())
    .addColumn("name", t.varchar(80))
    .addColumn("keywords", t.array('text'), (c) => c.notNull().defaultTo("{}"))
    .addColumn("is_favorite", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addColumn("position", t.integer(), (c) => c.notNull().defaultTo(0))
    .addColumn("added_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addUniqueConstraint("user_stickers_owner_id_storage_object_id_key", ["owner_id", "storage_object_id"])
    .addPrimaryKeyConstraint("user_stickers_pkey", ["id"])
    .execute();

  await db.schema.createTable("sticker_usage")
    .addColumn("owner_id", t.uuid(), (c) => c.notNull())
    .addColumn("storage_object_id", t.uuid(), (c) => c.notNull())
    .addColumn("use_count", t.integer(), (c) => c.notNull().defaultTo(0))
    .addColumn("last_used_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("sticker_usage_pkey", ["owner_id", "storage_object_id"])
    .execute();

  await db.schema.createTable("auto_reply_log")
    .addColumn("away_user_id", t.uuid(), (c) => c.notNull())
    .addColumn("peer_user_id", t.uuid(), (c) => c.notNull())
    .addColumn("last_sent_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("auto_reply_log_pkey", ["away_user_id", "peer_user_id"])
    .execute();

  await db.schema.createTable("scheduled_messages")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("sender_id", t.uuid(), (c) => c.notNull())
    .addColumn("body", t.text(), (c) => c.notNull())
    .addColumn("body_format", t.varchar(20), (c) => c.defaultTo("plain"))
    .addColumn("scheduled_at", t.timestamptz(), (c) => c.notNull())
    .addColumn("status", t.varchar(20), (c) => c.notNull().defaultTo("pending"))
    .addColumn("sent_message_id", t.uuid())
    .addColumn("error", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addColumn("updated_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addCheckConstraint("scheduled_messages_body_format_check", sql.raw("body_format IN ('plain', 'markdown', 'html')"))
    .addPrimaryKeyConstraint("scheduled_messages_pkey", ["id"])
    .addCheckConstraint("scheduled_messages_status_check", sql.raw("status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')"))
    .execute();

  await db.schema.createTable("message_reminders")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("message_id", t.uuid(), (c) => c.notNull())
    .addColumn("conversation_id", t.uuid(), (c) => c.notNull())
    .addColumn("remind_at", t.timestamptz(), (c) => c.notNull())
    .addColumn("note", t.varchar(200))
    .addColumn("status", t.varchar(20), (c) => c.notNull().defaultTo("pending"))
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("message_reminders_pkey", ["id"])
    .addCheckConstraint("message_reminders_status_check", sql.raw("status IN ('pending', 'done', 'cancelled')"))
    .execute();

  await db.schema.createTable("user_notification_settings")
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("dnd_enabled", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addColumn("dnd_until", t.timestamptz())
    .addColumn("quiet_hours_start", t.time())
    .addColumn("quiet_hours_end", t.time())
    .addColumn("quiet_days", t.array('smallint'), (c) => c.notNull().defaultTo("{}"))
    .addColumn("push_preview", t.varchar(10), (c) => c.notNull().defaultTo("full"))
    .addColumn("push_when", t.varchar(10), (c) => c.notNull().defaultTo("inactive"))
    .addColumn("sound_enabled", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addColumn("sound_name", t.varchar(30), (c) => c.notNull().defaultTo("ping"))
    .addColumn("sound_volume", t.smallint(), (c) => c.notNull().defaultTo(70))
    .addColumn("ringtone_name", t.varchar(30), (c) => c.notNull().defaultTo("classic"))
    .addColumn("badge_enabled", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addColumn("email_digest", t.varchar(10), (c) => c.notNull().defaultTo("off"))
    .addColumn("email_digest_hour", t.smallint(), (c) => c.notNull().defaultTo(9))
    .addColumn("email_unread_delay_minutes", t.smallint(), (c) => c.notNull().defaultTo(30))
    .addColumn("email_locale", t.varchar(10))
    .addColumn("updated_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addColumn("last_digest_at", t.timestamptz())
    .addColumn("call_privacy", t.varchar(10), (c) => c.notNull().defaultTo("everyone"))
    .addColumn("call_dnd_behavior", t.varchar(10), (c) => c.notNull().defaultTo("silent"))
    .addColumn("ringtone_volume", t.smallint(), (c) => c.notNull().defaultTo(80))
    .addColumn("join_muted", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addColumn("join_camera_off", t.boolean(), (c) => c.notNull().defaultTo(false))
    .addColumn("noise_suppression", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addColumn("echo_cancellation", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addColumn("auto_gain_control", t.boolean(), (c) => c.notNull().defaultTo(true))
    .addCheckConstraint("user_notification_settings_call_dnd_behavior_check", sql.raw("call_dnd_behavior IN ('reject', 'silent')"))
    .addCheckConstraint("user_notification_settings_call_privacy_check", sql.raw("call_privacy IN ('everyone', 'contacts', 'nobody')"))
    .addCheckConstraint("user_notification_settings_email_digest_check", sql.raw("email_digest IN ('off', 'hourly', 'daily', 'weekly')"))
    .addCheckConstraint("user_notification_settings_email_digest_hour_check", sql.raw("((email_digest_hour >= 0) AND (email_digest_hour <= 23))"))
    .addCheckConstraint("user_notification_settings_email_unread_delay_minutes_check", sql.raw("(email_unread_delay_minutes = ANY (ARRAY[15, 30, 60, 120]))"))
    .addPrimaryKeyConstraint("user_notification_settings_pkey", ["user_id"])
    .addCheckConstraint("user_notification_settings_push_preview_check", sql.raw("push_preview IN ('full', 'sender', 'none')"))
    .addCheckConstraint("user_notification_settings_push_when_check", sql.raw("push_when IN ('always', 'inactive')"))
    .addCheckConstraint("user_notification_settings_ringtone_volume_check", sql.raw("((ringtone_volume >= 0) AND (ringtone_volume <= 100))"))
    .addCheckConstraint("user_notification_settings_sound_volume_check", sql.raw("((sound_volume >= 0) AND (sound_volume <= 100))"))
    .execute();

  await db.schema.createTable("push_subscriptions")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("endpoint", t.text(), (c) => c.notNull())
    .addColumn("p256dh", t.text(), (c) => c.notNull())
    .addColumn("auth", t.text(), (c) => c.notNull())
    .addColumn("user_agent", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addColumn("last_used_at", t.timestamptz())
    .addColumn("failure_count", t.smallint(), (c) => c.notNull().defaultTo(0))
    .addUniqueConstraint("push_subscriptions_endpoint_key", ["endpoint"])
    .addPrimaryKeyConstraint("push_subscriptions_pkey", ["id"])
    .execute();

  await db.schema.createTable("email_outbox")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid())
    .addColumn("to_address", t.varchar(255), (c) => c.notNull())
    .addColumn("template", t.varchar(50), (c) => c.notNull())
    .addColumn("locale", t.varchar(10), (c) => c.notNull().defaultTo("es"))
    .addColumn("data", t.json(), (c) => c.notNull().defaultTo("{}"))
    .addColumn("status", t.varchar(10), (c) => c.notNull().defaultTo("pending"))
    .addColumn("attempts", t.smallint(), (c) => c.notNull().defaultTo(0))
    .addColumn("send_after", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addColumn("sent_at", t.timestamptz())
    .addColumn("last_error", t.text())
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("email_outbox_pkey", ["id"])
    .addCheckConstraint("email_outbox_status_check", sql.raw("status IN ('pending', 'sent', 'failed')"))
    .execute();

  await db.schema.createTable("password_tokens")
    .addColumn("id", t.uuid(), (c) => c.notNull().defaultTo(d.uuid()))
    .addColumn("user_id", t.uuid(), (c) => c.notNull())
    .addColumn("token_hash", t.char(64), (c) => c.notNull())
    .addColumn("purpose", t.varchar(10), (c) => c.notNull())
    .addColumn("expires_at", t.timestamptz(), (c) => c.notNull())
    .addColumn("used_at", t.timestamptz())
    .addColumn("created_at", t.timestamptz(), (c) => c.notNull().defaultTo(d.now()))
    .addPrimaryKeyConstraint("password_tokens_pkey", ["id"])
    .addCheckConstraint("password_tokens_purpose_check", sql.raw("purpose IN ('reset', 'invite')"))
    .addUniqueConstraint("password_tokens_token_hash_key", ["token_hash"])
    .execute();

  // ── Claves foráneas (después de crear todas las tablas) ──
  await db.schema.alterTable("user_credentials").addForeignKeyConstraint("user_credentials_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_sessions").addForeignKeyConstraint("user_sessions_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("role_permissions").addForeignKeyConstraint("role_permissions_permission_id_fkey", ["permission_id"], "permissions", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("role_permissions").addForeignKeyConstraint("role_permissions_role_id_fkey", ["role_id"], "roles", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_roles").addForeignKeyConstraint("user_roles_granted_by_fkey", ["granted_by"], "users", ["id"]).execute();
  await db.schema.alterTable("user_roles").addForeignKeyConstraint("user_roles_role_id_fkey", ["role_id"], "roles", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_roles").addForeignKeyConstraint("user_roles_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("storage_objects").addForeignKeyConstraint("storage_objects_uploader_id_fkey", ["uploader_id"], "users", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("storage_presigned_urls").addForeignKeyConstraint("storage_presigned_urls_object_id_fkey", ["object_id"], "storage_objects", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("storage_presigned_urls").addForeignKeyConstraint("storage_presigned_urls_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("conversations").addForeignKeyConstraint("conversations_avatar_object_id_fkey", ["avatar_object_id"], "storage_objects", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("conversations").addForeignKeyConstraint("conversations_created_by_fkey", ["created_by"], "users", ["id"]).execute();
  await db.schema.alterTable("conversations").addForeignKeyConstraint("fk_conversations_last_message", ["last_message_id"], "messages", ["id"], (fk) => fk.deferrable().initiallyDeferred()).execute();
  await db.schema.alterTable("conversation_members").addForeignKeyConstraint("conversation_members_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("conversation_members").addForeignKeyConstraint("conversation_members_invited_by_fkey", ["invited_by"], "users", ["id"]).execute();
  await db.schema.alterTable("conversation_members").addForeignKeyConstraint("conversation_members_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("conversation_events").addForeignKeyConstraint("conversation_events_actor_id_fkey", ["actor_id"], "users", ["id"]).execute();
  await db.schema.alterTable("conversation_events").addForeignKeyConstraint("conversation_events_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("conversation_events").addForeignKeyConstraint("conversation_events_target_user_id_fkey", ["target_user_id"], "users", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_deleted_by_fkey", ["deleted_by"], "users", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_forwarded_from_conv_fkey", ["forwarded_from_conv"], "conversations", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_forwarded_from_id_fkey", ["forwarded_from_id"], "messages", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_reply_to_id_fkey", ["reply_to_id"], "messages", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_sender_id_fkey", ["sender_id"], "users", ["id"]).execute();
  await db.schema.alterTable("messages").addForeignKeyConstraint("messages_thread_id_fkey", ["thread_id"], "messages", ["id"]).execute();
  await db.schema.alterTable("message_edits").addForeignKeyConstraint("message_edits_edited_by_fkey", ["edited_by"], "users", ["id"]).execute();
  await db.schema.alterTable("message_edits").addForeignKeyConstraint("message_edits_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_search_tokens").addForeignKeyConstraint("message_search_tokens_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_receipts").addForeignKeyConstraint("message_receipts_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_receipts").addForeignKeyConstraint("message_receipts_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_reactions").addForeignKeyConstraint("message_reactions_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_reactions").addForeignKeyConstraint("message_reactions_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("saved_messages").addForeignKeyConstraint("saved_messages_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("saved_messages").addForeignKeyConstraint("saved_messages_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("pinned_messages").addForeignKeyConstraint("pinned_messages_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("pinned_messages").addForeignKeyConstraint("pinned_messages_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("pinned_messages").addForeignKeyConstraint("pinned_messages_pinned_by_fkey", ["pinned_by"], "users", ["id"]).execute();
  await db.schema.alterTable("drafts").addForeignKeyConstraint("drafts_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("drafts").addForeignKeyConstraint("drafts_reply_to_id_fkey", ["reply_to_id"], "messages", ["id"]).execute();
  await db.schema.alterTable("drafts").addForeignKeyConstraint("drafts_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_attachments").addForeignKeyConstraint("message_attachments_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_attachments").addForeignKeyConstraint("message_attachments_object_id_fkey", ["object_id"], "storage_objects", ["id"]).execute();
  await db.schema.alterTable("calls").addForeignKeyConstraint("calls_conversation_id_fkey", ["conversation_id"], "conversations", ["id"]).execute();
  await db.schema.alterTable("calls").addForeignKeyConstraint("calls_initiated_by_fkey", ["initiated_by"], "users", ["id"]).execute();
  await db.schema.alterTable("call_participants").addForeignKeyConstraint("call_participants_call_id_fkey", ["call_id"], "calls", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("call_participants").addForeignKeyConstraint("call_participants_user_id_fkey", ["user_id"], "users", ["id"]).execute();
  await db.schema.alterTable("call_recordings").addForeignKeyConstraint("call_recordings_call_id_fkey", ["call_id"], "calls", ["id"]).execute();
  await db.schema.alterTable("call_recordings").addForeignKeyConstraint("call_recordings_object_id_fkey", ["object_id"], "storage_objects", ["id"]).execute();
  await db.schema.alterTable("call_recordings").addForeignKeyConstraint("call_recordings_started_by_fkey", ["started_by"], "users", ["id"]).execute();
  await db.schema.alterTable("broadcast_lists").addForeignKeyConstraint("broadcast_lists_owner_id_fkey", ["owner_id"], "users", ["id"]).execute();
  await db.schema.alterTable("broadcast_recipients").addForeignKeyConstraint("broadcast_recipients_added_by_fkey", ["added_by"], "users", ["id"]).execute();
  await db.schema.alterTable("broadcast_recipients").addForeignKeyConstraint("broadcast_recipients_broadcast_list_id_fkey", ["broadcast_list_id"], "broadcast_lists", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("broadcast_recipients").addForeignKeyConstraint("broadcast_recipients_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("broadcast_messages").addForeignKeyConstraint("broadcast_messages_broadcast_list_id_fkey", ["broadcast_list_id"], "broadcast_lists", ["id"]).execute();
  await db.schema.alterTable("broadcast_messages").addForeignKeyConstraint("broadcast_messages_object_id_fkey", ["object_id"], "storage_objects", ["id"]).execute();
  await db.schema.alterTable("broadcast_messages").addForeignKeyConstraint("broadcast_messages_sender_id_fkey", ["sender_id"], "users", ["id"]).execute();
  await db.schema.alterTable("broadcast_deliveries").addForeignKeyConstraint("broadcast_deliveries_broadcast_msg_id_fkey", ["broadcast_msg_id"], "broadcast_messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("broadcast_deliveries").addForeignKeyConstraint("broadcast_deliveries_conversation_id_fkey", ["conversation_id"], "conversations", ["id"]).execute();
  await db.schema.alterTable("broadcast_deliveries").addForeignKeyConstraint("broadcast_deliveries_user_id_fkey", ["user_id"], "users", ["id"]).execute();
  await db.schema.alterTable("channel_settings").addForeignKeyConstraint("channel_settings_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("channel_join_requests").addForeignKeyConstraint("channel_join_requests_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("channel_join_requests").addForeignKeyConstraint("channel_join_requests_reviewed_by_fkey", ["reviewed_by"], "users", ["id"]).execute();
  await db.schema.alterTable("channel_join_requests").addForeignKeyConstraint("channel_join_requests_user_id_fkey", ["user_id"], "users", ["id"]).execute();
  await db.schema.alterTable("polls").addForeignKeyConstraint("polls_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("poll_options").addForeignKeyConstraint("poll_options_poll_id_fkey", ["poll_id"], "polls", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("poll_votes").addForeignKeyConstraint("poll_votes_option_id_fkey", ["option_id"], "poll_options", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("poll_votes").addForeignKeyConstraint("poll_votes_poll_id_fkey", ["poll_id"], "polls", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("poll_votes").addForeignKeyConstraint("poll_votes_user_id_fkey", ["user_id"], "users", ["id"]).execute();
  await db.schema.alterTable("notifications").addForeignKeyConstraint("notifications_recipient_id_fkey", ["recipient_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("notification_preferences").addForeignKeyConstraint("notification_preferences_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_relationships").addForeignKeyConstraint("user_relationships_target_user_id_fkey", ["target_user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_relationships").addForeignKeyConstraint("user_relationships_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("audit_log").addForeignKeyConstraint("audit_log_actor_id_fkey", ["actor_id"], "users", ["id"]).execute();
  await db.schema.alterTable("audit_log").addForeignKeyConstraint("audit_log_session_id_fkey", ["session_id"], "user_sessions", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("system_settings").addForeignKeyConstraint("system_settings_updated_by_fkey", ["updated_by"], "users", ["id"]).execute();
  await db.schema.alterTable("games").addForeignKeyConstraint("games_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("games").addForeignKeyConstraint("games_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("games").addForeignKeyConstraint("games_player1_id_fkey", ["player1_id"], "users", ["id"]).execute();
  await db.schema.alterTable("games").addForeignKeyConstraint("games_player2_id_fkey", ["player2_id"], "users", ["id"]).execute();
  await db.schema.alterTable("games").addForeignKeyConstraint("games_winner_id_fkey", ["winner_id"], "users", ["id"]).execute();
  await db.schema.alterTable("user_wallpapers").addForeignKeyConstraint("user_wallpapers_storage_object_id_fkey", ["storage_object_id"], "storage_objects", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("user_wallpapers").addForeignKeyConstraint("user_wallpapers_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("sticker_packs").addForeignKeyConstraint("sticker_packs_owner_id_fkey", ["owner_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_stickers").addForeignKeyConstraint("user_stickers_owner_id_fkey", ["owner_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_stickers").addForeignKeyConstraint("user_stickers_pack_id_fkey", ["pack_id"], "sticker_packs", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("user_stickers").addForeignKeyConstraint("user_stickers_storage_object_id_fkey", ["storage_object_id"], "storage_objects", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("sticker_usage").addForeignKeyConstraint("sticker_usage_owner_id_fkey", ["owner_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("sticker_usage").addForeignKeyConstraint("sticker_usage_storage_object_id_fkey", ["storage_object_id"], "storage_objects", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("auto_reply_log").addForeignKeyConstraint("auto_reply_log_away_user_id_fkey", ["away_user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("auto_reply_log").addForeignKeyConstraint("auto_reply_log_peer_user_id_fkey", ["peer_user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("scheduled_messages").addForeignKeyConstraint("scheduled_messages_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("scheduled_messages").addForeignKeyConstraint("scheduled_messages_sender_id_fkey", ["sender_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("scheduled_messages").addForeignKeyConstraint("scheduled_messages_sent_message_id_fkey", ["sent_message_id"], "messages", ["id"], (fk) => fk.onDelete("set null")).execute();
  await db.schema.alterTable("message_reminders").addForeignKeyConstraint("message_reminders_conversation_id_fkey", ["conversation_id"], "conversations", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_reminders").addForeignKeyConstraint("message_reminders_message_id_fkey", ["message_id"], "messages", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("message_reminders").addForeignKeyConstraint("message_reminders_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("user_notification_settings").addForeignKeyConstraint("user_notification_settings_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("push_subscriptions").addForeignKeyConstraint("push_subscriptions_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("email_outbox").addForeignKeyConstraint("email_outbox_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();
  await db.schema.alterTable("password_tokens").addForeignKeyConstraint("password_tokens_user_id_fkey", ["user_id"], "users", ["id"], (fk) => fk.onDelete("cascade")).execute();

  // ── Índices ──
  await db.schema.createIndex("idx_attachments_message").on("message_attachments").columns(["message_id"]).execute();
  await db.schema.createIndex("idx_attachments_object").on("message_attachments").columns(["object_id"]).execute();
  await db.schema.createIndex("idx_audit_action").on("audit_log").columns(["action", "created_at desc"]).execute();
  await db.schema.createIndex("idx_audit_actor").on("audit_log").columns(["actor_id", "created_at desc"]).execute();
  await db.schema.createIndex("idx_audit_category").on("audit_log").columns(["category", "created_at desc"]).execute();
  await db.schema.createIndex("idx_audit_resource").on("audit_log").columns(["resource_type", "resource_id", "created_at desc"]).execute();
  await db.schema.createIndex("idx_audit_severity").on("audit_log").columns(["severity", "created_at desc"]).execute();
  await db.schema.createIndex("idx_call_participants_user").on("call_participants").columns(["user_id", "call_id"]).execute();
  await db.schema.createIndex("idx_calls_conversation").on("calls").columns(["conversation_id", "initiated_at desc"]).execute();
  await db.schema.createIndex("idx_calls_initiator").on("calls").columns(["initiated_by", "initiated_at desc"]).execute();
  await db.schema.createIndex("idx_conv_members_conv").on("conversation_members").columns(["conversation_id"]).where(sql.raw<boolean>("(left_at IS NULL)")).execute();
  await db.schema.createIndex("idx_conv_members_user").on("conversation_members").columns(["user_id"]).where(sql.raw<boolean>("((left_at IS NULL) AND (is_hidden = false))")).execute();
  await db.schema.createIndex("idx_email_outbox_created").on("email_outbox").columns(["created_at desc"]).execute();
  await db.schema.createIndex("idx_email_outbox_pending").on("email_outbox").columns(["send_after"]).where(sql.raw<boolean>("((status)::text = 'pending'::text)")).execute();
  await db.schema.createIndex("idx_games_message").on("games").columns(["message_id"]).execute();
  await db.schema.createIndex("idx_message_reminders_due").on("message_reminders").columns(["remind_at"]).where(sql.raw<boolean>("((status)::text = 'pending'::text)")).execute();
  await db.schema.createIndex("idx_message_reminders_user").on("message_reminders").columns(["user_id", "remind_at desc"]).execute();
  await db.schema.createIndex("idx_message_search_tokens_token").on("message_search_tokens").columns(["token"]).execute();
  await db.schema.createIndex("idx_messages_conversation").on("messages").columns(["conversation_id", "sent_at desc"]).where(sql.raw<boolean>("(is_deleted = false)")).execute();
  await db.schema.createIndex("idx_messages_reply").on("messages").columns(["reply_to_id"]).where(sql.raw<boolean>("(reply_to_id IS NOT NULL)")).execute();
  await db.schema.createIndex("idx_messages_sender").on("messages").columns(["sender_id", "sent_at desc"]).execute();
  await db.schema.createIndex("idx_messages_thread").on("messages").columns(["thread_id"]).where(sql.raw<boolean>("(thread_id IS NOT NULL)")).execute();
  await db.schema.createIndex("idx_monitoring_snapshots_fecha").on("monitoring_snapshots").columns(["fecha_registro desc"]).execute();
  await db.schema.createIndex("idx_monitoring_snapshots_host_fecha").on("monitoring_snapshots").columns(["host", "fecha_registro desc"]).execute();
  await db.schema.createIndex("idx_notifications_email_due").on("notifications").columns(["email_due_at"]).where(sql.raw<boolean>("((email_due_at IS NOT NULL) AND (emailed_at IS NULL))")).execute();
  await db.schema.createIndex("idx_notifications_unread").on("notifications").columns(["recipient_id", "created_at desc"]).where(sql.raw<boolean>("(is_read = false)")).execute();
  await db.schema.createIndex("idx_password_tokens_user").on("password_tokens").columns(["user_id"]).execute();
  await db.schema.createIndex("idx_presigned_active").on("storage_presigned_urls").columns(["object_id", "user_id", "operation", "expires_at"]).execute();
  await db.schema.createIndex("idx_push_subscriptions_user").on("push_subscriptions").columns(["user_id"]).execute();
  await db.schema.createIndex("idx_receipts_message").on("message_receipts").columns(["message_id"]).execute();
  await db.schema.createIndex("idx_receipts_user_unread").on("message_receipts").columns(["user_id", "message_id"]).where(sql.raw<boolean>("(read_at IS NULL)")).execute();
  await db.schema.createIndex("idx_scheduled_messages_due").on("scheduled_messages").columns(["scheduled_at"]).where(sql.raw<boolean>("((status)::text = 'pending'::text)")).execute();
  await db.schema.createIndex("idx_scheduled_messages_sender").on("scheduled_messages").columns(["sender_id", "scheduled_at desc"]).execute();
  await db.schema.createIndex("idx_sessions_token").on("user_sessions").columns(["token_hash"]).where(sql.raw<boolean>("(is_active = true)")).execute();
  await db.schema.createIndex("idx_sessions_user_active").on("user_sessions").columns(["user_id"]).where(sql.raw<boolean>("(is_active = true)")).execute();
  await db.schema.createIndex("idx_sticker_usage_recent").on("sticker_usage").columns(["owner_id", "last_used_at desc"]).execute();
  await db.schema.createIndex("idx_storage_hash").on("storage_objects").columns(["file_hash_sha256"]).where(sql.raw<boolean>("(file_hash_sha256 IS NOT NULL)")).execute();
  await db.schema.createIndex("idx_storage_pending").on("storage_objects").columns(["processing_status", "uploaded_at"]).where(sql.raw<boolean>("processing_status IN ('pending', 'processing')")).execute();
  await db.schema.createIndex("idx_user_stickers_object").on("user_stickers").columns(["storage_object_id"]).execute();
  await db.schema.createIndex("idx_user_wallpapers_user").on("user_wallpapers").columns(["user_id"]).execute();
  await db.schema.createIndex("idx_users_away_until").on("users").columns(["away_until"]).where(sql.raw<boolean>("(away_until IS NOT NULL)")).execute();
  await db.schema.createIndex("idx_users_external_id").on("users").columns(["external_id"]).unique().where(sql.raw<boolean>("(external_id IS NOT NULL)")).execute();
  await db.schema.createIndex("idx_users_presence").on("users").columns(["presence", "last_seen_at"]).execute();
  await db.schema.createIndex("idx_users_status").on("users").columns(["status"]).where(sql.raw<boolean>("((status)::text <> 'deleted'::text)")).execute();
  await db.schema.createIndex("pinned_messages_conversation_id_key").on("pinned_messages").columns(["conversation_id"]).unique().execute();

  // ── Exclusivo de PostgreSQL: índices GIN/de expresión, funciones, triggers y comentarios ──
  await onPostgres(db, async (db) => {
    await sql.raw("CREATE INDEX idx_sticker_packs_owner ON sticker_packs USING btree (owner_id, \"position\")").execute(db);
    await sql.raw("CREATE INDEX idx_user_stickers_keywords ON user_stickers USING gin (keywords)").execute(db);
    await sql.raw("CREATE INDEX idx_user_stickers_owner ON user_stickers USING btree (owner_id, \"position\")").execute(db);
    await sql.raw("CREATE INDEX idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops)").execute(db);
    await sql.raw("CREATE OR REPLACE FUNCTION public.fn_calculate_call_duration()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n    IF NEW.ended_at IS NOT NULL\r\n       AND OLD.ended_at IS NULL\r\n       AND NEW.answered_at IS NOT NULL\r\n    THEN\r\n        NEW.duration_seconds :=\r\n            EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INTEGER;\r\n    END IF;\r\n    RETURN NEW;\r\nEND;\r\n$function$").execute(db);
    await sql.raw("CREATE OR REPLACE FUNCTION public.fn_set_updated_at()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n    NEW.updated_at = NOW();\r\n    RETURN NEW;\r\nEND;\r\n$function$").execute(db);
    await sql.raw("CREATE OR REPLACE FUNCTION public.fn_update_channel_member_count()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n    -- Se ejecuta tanto en INSERT como en UPDATE (cuando cambia left_at)\r\n    UPDATE channel_settings cs\r\n    SET member_count = (\r\n        SELECT COUNT(*) FROM conversation_members cm\r\n        WHERE cm.conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id)\r\n          AND cm.left_at IS NULL\r\n    )\r\n    WHERE cs.conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id);\r\n    RETURN NEW;\r\nEND;\r\n$function$").execute(db);
    await sql.raw("CREATE OR REPLACE FUNCTION public.fn_update_conversation_last_message()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n    UPDATE conversations\r\n    SET last_message_at = NEW.sent_at,\r\n        last_message_id  = NEW.id,\r\n        updated_at       = NOW()\r\n    WHERE id = NEW.conversation_id;\r\n    RETURN NEW;\r\nEND;\r\n$function$").execute(db);
    await sql.raw("CREATE TRIGGER trg_broadcast_lists_updated_at BEFORE UPDATE ON broadcast_lists FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()").execute(db);
    await sql.raw("CREATE TRIGGER trg_call_duration BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION fn_calculate_call_duration()").execute(db);
    await sql.raw("CREATE TRIGGER trg_channel_member_count AFTER INSERT OR UPDATE OF left_at ON conversation_members FOR EACH ROW EXECUTE FUNCTION fn_update_channel_member_count()").execute(db);
    await sql.raw("CREATE TRIGGER trg_channel_settings_updated_at BEFORE UPDATE ON channel_settings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()").execute(db);
    await sql.raw("CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()").execute(db);
    await sql.raw("CREATE TRIGGER trg_message_update_conversation AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION fn_update_conversation_last_message()").execute(db);
    await sql.raw("CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()").execute(db);
    await sql.raw("COMMENT ON TABLE audit_log IS 'Log inmutable de acciones críticas. En producción ejecutar: REVOKE UPDATE, DELETE ON audit_log FROM app_role;'").execute(db);
    await sql.raw("COMMENT ON TABLE auto_reply_log IS 'Última auto-respuesta enviada por cada usuario ausente a cada interlocutor.'").execute(db);
    await sql.raw("COMMENT ON COLUMN conversation_members.notification_level IS 'all = todo; mentions = sólo menciones; none = nada (ni menciones). is_muted silencia todo menos menciones.'").execute(db);
    await sql.raw("COMMENT ON COLUMN conversations.only_admins_edit_info IS 'Si es TRUE, sólo owner/admin pueden editar nombre, descripción y foto del grupo.'").execute(db);
    await sql.raw("COMMENT ON TABLE message_reminders IS 'Avisos que un usuario se pone a sí mismo sobre un mensaje.'").execute(db);
    await sql.raw("COMMENT ON TABLE messages IS 'Todos los mensajes del sistema. En producción con alto volumen, considerar particionar por sent_at: PARTITION BY RANGE (sent_at) con particiones mensuales.'").execute(db);
    await sql.raw("COMMENT ON TABLE push_subscriptions IS 'Navegadores/dispositivos suscriptos a Web Push de cada usuario.'").execute(db);
    await sql.raw("COMMENT ON TABLE scheduled_messages IS 'Mensajes en espera de despacho automático (job scheduled-messages).'").execute(db);
    await sql.raw("COMMENT ON TABLE storage_objects IS 'Inventario de todos los archivos almacenados en MinIO. Nunca se guardan rutas de filesystem ni binarios. El backend construye la URL usando bucket_name + object_key + endpoint de system_settings.'").execute(db);
    await sql.raw("COMMENT ON COLUMN storage_objects.object_key IS 'Ruta del objeto dentro del bucket. Convención: {tipo}/{año}/{mes}/{uuid}.{ext} Ej: images/2026/04/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg El prefijo permite lifecycle policies y cleanup por fecha en MinIO.'").execute(db);
    await sql.raw("COMMENT ON COLUMN storage_objects.file_hash_sha256 IS 'Hash SHA-256 del archivo. Antes de subir a MinIO el backend consulta si ya existe este hash. Si existe, reutiliza el mismo objeto (deduplicación) sin re-subir.'").execute(db);
    await sql.raw("COMMENT ON COLUMN storage_objects.access_policy IS 'private = solo accesible via presigned URL (recomendado para media de usuarios). public = accesible directo por URL (solo para assets públicos como stickers).'").execute(db);
    await sql.raw("COMMENT ON TABLE storage_presigned_urls IS 'Cache de presigned URLs generadas por MinIO/S3. El backend regenera automáticamente cuando expires_at < NOW(). TTL configurable en system_settings.presigned_url_ttl_seconds.'").execute(db);
    await sql.raw("COMMENT ON COLUMN user_credentials.totp_secret IS 'Secreto TOTP en base32. NULL si el usuario no tiene 2FA.'").execute(db);
    await sql.raw("COMMENT ON COLUMN user_credentials.totp_enabled IS 'TRUE sólo después de que el usuario confirmó un código válido.'").execute(db);
    await sql.raw("COMMENT ON COLUMN user_credentials.totp_backup_codes IS 'Hashes de los códigos de respaldo sin usar.'").execute(db);
    await sql.raw("COMMENT ON TABLE user_notification_settings IS 'Preferencias globales de notificación de cada usuario. Sin fila = valores por defecto.'").execute(db);
    await sql.raw("COMMENT ON COLUMN users.away_until IS 'Fin de la ausencia. NULL = sin vencimiento (se limpia a mano).'").execute(db);
    await sql.raw("COMMENT ON COLUMN users.auto_reply_enabled IS 'TRUE = presence_message se responde automáticamente en chats directos.'").execute(db);
  });
}
