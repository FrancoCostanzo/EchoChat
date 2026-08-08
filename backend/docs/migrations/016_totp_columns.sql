-- 2FA por TOTP: columnas que el código ya usaba pero que nunca estuvieron en el
-- schema base ni en ninguna migración.
--
-- El backend implementa 2FA completo (auth.service + credential.repository:
-- setTotpSecret, enableTotp, disableTotp, updateBackupCodes, removeBackupCode),
-- pero `user_credentials` no tenía dónde guardarlo. En las instalaciones viejas
-- las columnas se habían agregado a mano, y como migrate.js baselinea las bases
-- preexistentes —marca todo como aplicado sin ejecutarlo— la diferencia nunca
-- salió a la luz. En una instalación nueva, activar 2FA fallaba con
-- `column "totp_secret" of relation "user_credentials" does not exist`.
--
-- Detectado al generar los tipos del schema para la migración a TypeScript: el
-- tipo de la fila no tenía las columnas que el servicio leía.
--
-- Idempotente: se puede correr varias veces sin efectos.

ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS totp_secret       TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] NOT NULL DEFAULT '{}';

-- Los códigos de respaldo se guardan hasheados y se consumen de a uno
-- (array_remove); el secreto sólo se lee al verificar un código.
COMMENT ON COLUMN user_credentials.totp_secret       IS 'Secreto TOTP en base32. NULL si el usuario no tiene 2FA.';
COMMENT ON COLUMN user_credentials.totp_enabled      IS 'TRUE sólo después de que el usuario confirmó un código válido.';
COMMENT ON COLUMN user_credentials.totp_backup_codes IS 'Hashes de los códigos de respaldo sin usar.';
