-- =============================================================================
-- MIGRACIÓN 001 — Seed de role_permissions
--
-- El schema base v2.0 sembraba `roles` y `permissions` pero NUNCA mapeaba
-- `role_permissions`, por lo que ningún usuario tenía permisos efectivos.
-- Esta migración asigna los permisos por defecto a cada rol del sistema.
--
-- Idempotente: usa ON CONFLICT DO NOTHING. Se puede ejecutar varias veces.
--   psql -U echochat -d echochat -f 001_seed_role_permissions.sql
-- =============================================================================

-- super_admin y admin: TODOS los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

-- moderator: permisos de usuario estándar + moderación de contenido
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
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
SELECT r.id, p.id
FROM roles r
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

-- readonly: sin permisos de escritura (solo lectura, que no se controla por permission code)
-- No se insertan filas a propósito.
