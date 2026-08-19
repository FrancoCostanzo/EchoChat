-- =============================================================================
-- MIGRACIÓN 009: Mejoras al log de auditoría (idempotente)
-- Agrega: severity, category, session_id, duration_ms, metadata
--
-- Nota: el schema base ya trae `audit_log.category VARCHAR(50)`. Por eso aquí
-- se usa ADD COLUMN IF NOT EXISTS (no re-crea columnas existentes) y se
-- normaliza el default/backfill sin cambiar el tipo. 100% idempotente:
--   psql -U postgres -d EchoChat -f 009_audit_log_improvements.sql
-- =============================================================================

-- Nuevas columnas (IF NOT EXISTS → seguro re-ejecutar)
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS severity    VARCHAR(10),
  ADD COLUMN IF NOT EXISTS category    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS session_id  UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS metadata    JSONB;

-- Default + backfill de severity.
ALTER TABLE audit_log ALTER COLUMN severity SET DEFAULT 'info';
UPDATE audit_log SET severity = 'info' WHERE severity IS NULL;

-- Default + backfill de category (la columna del schema base no trae default).
ALTER TABLE audit_log ALTER COLUMN category SET DEFAULT 'system';
UPDATE audit_log SET category = 'system' WHERE category IS NULL;

-- Índices para filtrado rápido
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(category, created_at DESC);

-- Categorías/severidades inferidas para registros existentes
UPDATE audit_log SET category = 'auth',     severity = 'info'     WHERE action IN ('user.register', 'user.login', 'user.logout', 'user.change_password') AND success = true;
UPDATE audit_log SET category = 'security', severity = 'warning'  WHERE action = 'user.login' AND success = false;
UPDATE audit_log SET category = 'security', severity = 'warning'  WHERE action = 'user.change_password';
UPDATE audit_log SET category = 'admin',    severity = 'info'     WHERE action = 'admin.user_create';
UPDATE audit_log SET category = 'admin',    severity = 'warning'  WHERE action IN ('admin.user_update', 'admin.user_reset_password', 'admin.setting_update', 'admin.ldap_sync');
UPDATE audit_log SET category = 'admin',    severity = 'critical' WHERE action = 'admin.user_delete';
UPDATE audit_log SET category = 'content',  severity = 'info'     WHERE action IN ('message.delete', 'conversation.member_role_change');
