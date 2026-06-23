-- =============================================================================
-- MIGRACIÓN 006 — Integración LDAP + bloqueo de auto-registro (idempotente)
--
-- Para instancias cuya BD se creó antes de soportar:
--   1. Login híbrido: cada usuario recuerda su proveedor de autenticación
--      ('local' = contraseña bcrypt en user_credentials; 'ldap' = bind contra
--      el directorio). Se agrega `auth_provider` y `external_id` (id estable del
--      directorio) a `users`, más un índice único parcial sobre `external_id`.
--   2. Toggle `allow_registration` en system_settings para cortar el auto-registro
--      público (POST /auth/register) desde el panel admin, sin afectar el alta
--      manual de administradores.
--
-- 100% idempotente. Se puede correr varias veces:
--   psql -U echochat -d echochat -f 006_ldap_and_registration.sql
-- =============================================================================

-- 1. Proveedor de autenticación e identidad de directorio --------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- CHECK del proveedor (sólo si todavía no existe esa restricción)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_auth_provider_check
            CHECK (auth_provider IN ('local','ldap'));
    END IF;
END$$;

-- Identidad LDAP única; los usuarios locales (external_id NULL) no compiten
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id
    ON users(external_id) WHERE external_id IS NOT NULL;

-- 2. Setting de auto-registro ------------------------------------------------
INSERT INTO system_settings (key, value, description, category) VALUES
    ('allow_registration', 'true',
     'Permitir el auto-registro público de usuarios (POST /auth/register)', 'security')
ON CONFLICT (key) DO NOTHING;
