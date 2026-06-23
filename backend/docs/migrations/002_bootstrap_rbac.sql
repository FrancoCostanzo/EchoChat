-- =============================================================================
-- MIGRACIÓN 002 — Bootstrap RBAC (idempotente)
--
-- En algunas instancias la sección "DATOS INICIALES" del schema base nunca se
-- ejecutó, dejando `roles`, `permissions` y `role_permissions` VACÍAS. Como
-- consecuencia ningún usuario tiene permisos efectivos y las rutas protegidas
-- (p. ej. POST /api/storage/upload → requirePermission('media.upload'))
-- responden 403 "Missing required permission: media.upload".
--
-- Esta migración:
--   1. Siembra los roles del sistema.
--   2. Siembra los permisos atómicos.
--   3. Mapea rol → permisos (super_admin/admin = todos; moderator/user estándar).
--   4. Backfill: asigna el rol 'user' a todo usuario que haya quedado sin rol.
--
-- Es 100% idempotente (ON CONFLICT DO NOTHING). Se puede correr varias veces.
--   psql -U postgres -d EchoChat -f 002_bootstrap_rbac.sql
-- =============================================================================

-- 1. Roles del sistema -------------------------------------------------------
INSERT INTO roles (name, display_name, description, is_system, priority) VALUES
    ('super_admin', 'Super Administrador', 'Acceso total sin restricciones', TRUE, 100),
    ('admin',       'Administrador',       'Gestión de usuarios y contenido', TRUE, 80),
    ('moderator',   'Moderador',           'Moderar mensajes y grupos', TRUE, 50),
    ('user',        'Usuario',             'Rol estándar', TRUE, 10),
    ('readonly',    'Solo Lectura',        'Ver pero no escribir', TRUE, 5)
ON CONFLICT (name) DO NOTHING;

-- 2. Permisos atómicos -------------------------------------------------------
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

-- 3. Mapeo rol → permisos ----------------------------------------------------
-- super_admin y admin: todos los permisos
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

-- 4. Backfill: asignar rol 'user' a usuarios sin ningún rol ------------------
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.name = 'user'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;
