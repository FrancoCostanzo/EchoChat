-- =============================================================================
-- MIGRACIÓN 010 — SSO por OIDC (OpenID Connect) — idempotente
--
-- Habilita nuevos proveedores de autenticación además de 'local' y 'ldap':
--   'oidc' — Azure AD / Google Workspace / Okta y cualquier IdP OpenID Connect.
--   'saml' — reservado para una fase posterior (SSO SAML 2.0).
--   'scim' — reservado para aprovisionamiento SCIM 2.0.
--
-- Los usuarios OIDC no tienen fila en user_credentials: la identidad la afirma el
-- IdP. Se reutiliza `external_id` (ya existente) con el formato "oidc:<provider>:<sub>"
-- para garantizar un id estable y único por proveedor.
--
-- 100% idempotente:
--   psql -U echochat -d echochat -f 010_oidc_sso.sql
-- =============================================================================

-- Reemplaza el CHECK de auth_provider para admitir los nuevos proveedores.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_provider_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_auth_provider_check;
    END IF;

    ALTER TABLE users
        ADD CONSTRAINT users_auth_provider_check
        CHECK (auth_provider IN ('local', 'ldap', 'oidc', 'saml', 'scim'));
END$$;
