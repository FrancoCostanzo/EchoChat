-- =============================================================================
-- MIGRACIÓN 009: Mejoras al log de auditoría
-- Agrega: severity, category, session_id, duration_ms, metadata
-- =============================================================================

-- Nuevas columnas
ALTER TABLE audit_log
  ADD COLUMN severity    VARCHAR(10)  NOT NULL DEFAULT 'info'
                          CHECK (severity IN ('info', 'warning', 'critical')),
  ADD COLUMN category    VARCHAR(20)  NOT NULL DEFAULT 'system'
                          CHECK (category IN ('auth', 'admin', 'content', 'system', 'security')),
  ADD COLUMN session_id  UUID         REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN duration_ms INTEGER,
  ADD COLUMN metadata    JSONB;

-- Índices para filtrado rápido
CREATE INDEX idx_audit_action   ON audit_log(action, created_at DESC);
CREATE INDEX idx_audit_severity ON audit_log(severity, created_at DESC);
CREATE INDEX idx_audit_category ON audit_log(category, created_at DESC);

-- Categorías inferidas para registros existentes
UPDATE audit_log SET category = 'auth',     severity = 'info'     WHERE action IN ('user.register', 'user.login', 'user.logout', 'user.change_password') AND success = true;
UPDATE audit_log SET category = 'security', severity = 'warning'  WHERE action = 'user.login' AND success = false;
UPDATE audit_log SET category = 'security', severity = 'warning'  WHERE action = 'user.change_password';
UPDATE audit_log SET category = 'admin',    severity = 'info'     WHERE action = 'admin.user_create';
UPDATE audit_log SET category = 'admin',    severity = 'warning'  WHERE action IN ('admin.user_update', 'admin.user_reset_password', 'admin.setting_update', 'admin.ldap_sync');
UPDATE audit_log SET category = 'admin',    severity = 'critical' WHERE action = 'admin.user_delete';
UPDATE audit_log SET category = 'content',  severity = 'info'     WHERE action IN ('message.delete', 'conversation.member_role_change');
