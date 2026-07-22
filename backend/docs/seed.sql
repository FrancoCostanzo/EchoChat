-- =============================================================================
-- SEED — Datos de referencia del sistema (idempotente)
--
-- Esto NO son datos de ejemplo: son datos que la aplicación necesita para
-- funcionar (roles, permisos, su mapeo y la configuración por defecto).
--
-- Todo usa ON CONFLICT DO NOTHING, así que el backend lo aplica en CADA
-- arranque para "converger": cuando se agrega un permiso o setting nuevo acá,
-- todas las instancias existentes lo reciben en el próximo inicio, sin
-- necesidad de escribir una migración.
--
-- Reglas al editar:
--   - Agregar filas nuevas es seguro (se insertan donde falten).
--   - NO renombres/borres códigos de permiso ya usados por el código.
--   - Los permisos nuevos se asignan solos a super_admin/admin (usan CROSS JOIN).
-- =============================================================================

-- ── Roles del sistema ────────────────────────────────────────────────────
INSERT INTO roles (name, display_name, description, is_system, priority) VALUES
    ('super_admin', 'Super Administrador', 'Acceso total sin restricciones', TRUE, 100),
    ('admin',       'Administrador',       'Gestión de usuarios y contenido', TRUE, 80),
    ('moderator',   'Moderador',           'Moderar mensajes y grupos', TRUE, 50),
    ('user',        'Usuario',             'Rol estándar', TRUE, 10),
    ('readonly',    'Solo Lectura',        'Ver pero no escribir', TRUE, 5)
ON CONFLICT (name) DO NOTHING;

-- ── Permisos atómicos ────────────────────────────────────────────────────
INSERT INTO permissions (code, category, description) VALUES
    ('messages.send',          'messages',  'Enviar mensajes de texto'),
    ('messages.send_media',    'messages',  'Enviar imágenes, videos y archivos'),
    ('messages.send_voice',    'messages',  'Enviar notas de voz'),
    ('messages.delete_own',    'messages',  'Eliminar propios mensajes'),
    ('messages.delete_any',    'messages',  'Eliminar mensajes de cualquier usuario'),
    ('messages.edit',          'messages',  'Editar propios mensajes'),
    ('calls.make_voice',       'calls',     'Iniciar llamadas de voz'),
    ('calls.make_video',       'calls',     'Iniciar videollamadas'),
    ('calls.make_conference',  'calls',     'Iniciar conferencias grupales'),
    ('calls.record',           'calls',     'Grabar llamadas'),
    ('groups.create',          'groups',    'Crear grupos y canales'),
    ('groups.manage_own',      'groups',    'Administrar grupos propios'),
    ('groups.manage_any',      'groups',    'Administrar cualquier grupo'),
    ('groups.invite',          'groups',    'Invitar usuarios a grupos'),
    ('broadcast.create',       'broadcast', 'Crear listas de difusión'),
    ('broadcast.send',         'broadcast', 'Enviar mensajes de difusión'),
    ('media.upload',           'media',     'Subir archivos al sistema'),
    ('media.delete_own',       'media',     'Eliminar propios archivos'),
    ('media.delete_any',       'media',     'Eliminar archivos de cualquier usuario'),
    ('admin.users',            'admin',     'Gestionar usuarios'),
    ('admin.settings',         'admin',     'Cambiar configuración del sistema'),
    ('admin.view_audit',       'admin',     'Ver logs de auditoría'),
    ('admin.storage',          'admin',     'Ver y gestionar el almacenamiento MinIO')
ON CONFLICT (code) DO NOTHING;

-- ── Mapeo rol → permisos ──────────────────────────────────────────────────
-- super_admin y admin: TODOS los permisos (los nuevos se auto-asignan)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

-- moderator: permisos estándar + moderación de contenido
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
    'messages.send', 'messages.send_media', 'messages.send_voice',
    'messages.delete_own', 'messages.edit', 'messages.delete_any',
    'calls.make_voice', 'calls.make_video', 'calls.make_conference', 'calls.record',
    'groups.create', 'groups.manage_own', 'groups.manage_any', 'groups.invite',
    'broadcast.create', 'broadcast.send',
    'media.upload', 'media.delete_own', 'media.delete_any'
)
WHERE r.name = 'moderator'
ON CONFLICT DO NOTHING;

-- user: permisos estándar de un empleado
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
    'messages.send', 'messages.send_media', 'messages.send_voice',
    'messages.delete_own', 'messages.edit',
    'calls.make_voice', 'calls.make_video', 'calls.make_conference',
    'groups.create', 'groups.manage_own', 'groups.invite',
    'broadcast.create', 'broadcast.send',
    'media.upload', 'media.delete_own'
)
WHERE r.name = 'user'
ON CONFLICT DO NOTHING;

-- ── Configuración del sistema (incluye parámetros de MinIO) ────────────────
INSERT INTO system_settings (key, value, description, category) VALUES
    -- MinIO / Object Storage
    ('storage_endpoint',           '"http://minio.intranet:9000"',
     'URL interna del servidor MinIO', 'storage'),
    ('storage_region',             '"us-east-1"',
     'Región configurada en MinIO (puede ser cualquier string)', 'storage'),
    ('storage_bucket_images',      '"messaging-images"',     'Bucket para imágenes', 'storage'),
    ('storage_bucket_videos',      '"messaging-videos"',     'Bucket para videos', 'storage'),
    ('storage_bucket_audio',       '"messaging-audio"',      'Bucket para audios y voicenotes', 'storage'),
    ('storage_bucket_documents',   '"messaging-documents"',  'Bucket para documentos', 'storage'),
    ('storage_bucket_thumbnails',  '"messaging-thumbnails"', 'Bucket para previews generados', 'storage'),
    ('storage_bucket_recordings',  '"messaging-recordings"', 'Bucket para grabaciones de llamadas', 'storage'),
    ('storage_bucket_avatars',     '"messaging-avatars"',    'Bucket para avatares', 'storage'),
    ('storage_bucket_stickers',    '"messaging-stickers"',   'Bucket para packs de stickers', 'storage'),
    ('presigned_url_ttl_seconds',  '3600',
     'TTL de las presigned URLs generadas (en segundos)', 'storage'),
    ('presigned_url_cache_seconds','3300',
     'Tiempo que se cachea la URL antes de regenerar (menor que ttl)', 'storage'),
    -- Límites de archivos
    ('max_image_size_mb',          '20',     'Tamaño máximo de imágenes en MB', 'media'),
    ('max_video_size_mb',          '500',    'Tamaño máximo de videos en MB', 'media'),
    ('max_audio_size_mb',          '50',     'Tamaño máximo de audios en MB', 'media'),
    ('max_document_size_mb',       '100',    'Tamaño máximo de documentos en MB', 'media'),
    ('max_voice_duration_seconds', '300',    'Duración máxima de notas de voz en segundos', 'media'),
    ('allowed_mime_types',
     '["image/jpeg","image/png","image/gif","image/webp","video/mp4","video/webm","audio/ogg","audio/mpeg","audio/aac","audio/webm","application/pdf","application/zip","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]',
     'MIME types permitidos para subida', 'media'),
    -- Grupos y general
    ('max_group_members',          '500',   'Máximo de miembros por grupo', 'groups'),
    ('call_recording_enabled',     'false', 'Habilitar grabación de llamadas', 'calls'),
    ('require_call_consent',       'true',  'Requerir consentimiento explícito para grabar', 'calls'),
    ('message_retention_days',     '0',     'Días de retención de mensajes (0 = sin límite)', 'general'),
    ('presence_timeout_minutes',   '5',     'Minutos de inactividad para pasar a "away"', 'general'),
    ('message_edit_window_minutes', '15',
     'Minutos para editar un mensaje propio (0 = sin límite)', 'messages'),
    ('message_delete_window_minutes', '15',
     'Minutos para eliminar un mensaje propio (0 = sin límite)', 'messages'),
    ('max_broadcast_recipients',   '1000',  'Máximo de destinatarios en una difusión', 'broadcast'),
    -- Seguridad / altas
    ('allow_registration',         'true',  'Permitir el auto-registro público de usuarios (POST /auth/register)', 'security')
ON CONFLICT (key) DO NOTHING;

-- ── Backfill: todo usuario sin ningún rol recibe 'user' ────────────────────
-- Red de seguridad para usuarios creados antes de tener RBAC o importados sin rol.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.name = 'user'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;
