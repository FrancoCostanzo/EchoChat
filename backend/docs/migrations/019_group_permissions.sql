-- Permisos de grupo configurables por admin.
--
-- `conversations.is_read_only` ya existía pero nunca se enforced (ver
-- message.service.ts) — pasa a controlar si sólo los admins pueden enviar
-- mensajes. Se suma `only_admins_edit_info` para el mismo control sobre
-- nombre/descripción/foto del grupo (antes era siempre owner/admin, fijo).
--
-- Default TRUE: preserva el comportamiento actual (sólo owner/admin editaban
-- la info del grupo) hasta que alguien lo relaje explícitamente.
--
-- Idempotente: se puede correr varias veces sin efectos.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS only_admins_edit_info BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN conversations.only_admins_edit_info IS
  'Si es TRUE, sólo owner/admin pueden editar nombre, descripción y foto del grupo.';
