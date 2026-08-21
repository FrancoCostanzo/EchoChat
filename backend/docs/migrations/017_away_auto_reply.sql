-- Estado de ausencia con auto-respuesta.
--
-- `users.presence_message` ya existía (el DTO de perfil lo aceptaba) pero no
-- había forma de decir "hasta cuándo" ni de que ese texto le llegue solo a quien
-- escribe. Estas tres columnas cierran eso:
--
--   · away_until          — cuándo vence la ausencia; un job la limpia sola.
--   · auto_reply_enabled  — si además de mostrarse, el texto se responde en DMs.
--   · presence_message    — (ya existía) es el mismo texto para las dos cosas,
--                           a propósito: dos textos separados obligan a mantener
--                           dos redacciones para el mismo aviso.
--
-- Idempotente: se puede correr varias veces sin efectos.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS away_until         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.away_until         IS 'Fin de la ausencia. NULL = sin vencimiento (se limpia a mano).';
COMMENT ON COLUMN users.auto_reply_enabled IS 'TRUE = presence_message se responde automáticamente en chats directos.';

-- El job de vencimiento barre por esta columna cada pocos minutos.
CREATE INDEX IF NOT EXISTS idx_users_away_until
  ON users (away_until) WHERE away_until IS NOT NULL;

-- Anti-spam de la auto-respuesta: una sola por persona cada N horas, sin
-- importar cuántos mensajes mande. La fila se pisa (UPSERT) en cada envío, así
-- que la tabla crece por pares que efectivamente se escribieron, no por mensaje.
CREATE TABLE IF NOT EXISTS auto_reply_log (
    away_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    peer_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (away_user_id, peer_user_id)
);

COMMENT ON TABLE auto_reply_log IS 'Última auto-respuesta enviada por cada usuario ausente a cada interlocutor.';
