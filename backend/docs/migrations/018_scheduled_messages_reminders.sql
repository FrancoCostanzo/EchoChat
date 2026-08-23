-- Mensajes programados y recordatorios.
--
-- Mismo patrón que las difusiones programadas (broadcast_messages.scheduled_at +
-- job cada minuto), pero para cualquier conversación y para cualquier usuario,
-- sin necesitar el permiso `broadcast.create`.
--
--   · scheduled_messages — "mandá esto el lunes 9:00".
--   · message_reminders  — "recordame este mensaje mañana".
--
-- El body va cifrado con el mismo esquema que `messages.body` (utils/crypto.util):
-- un mensaje programado es texto de un usuario esperando en la base, no habría
-- razón para guardarlo en claro cuando el enviado sí se cifra.
--
-- Idempotente: se puede correr varias veces sin efectos.

CREATE TABLE IF NOT EXISTS scheduled_messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body             TEXT NOT NULL,
    body_format      VARCHAR(20) DEFAULT 'plain'
                     CHECK (body_format IN ('plain','markdown','html')),
    scheduled_at     TIMESTAMPTZ NOT NULL,
    -- 'sending' es el estado intermedio con el que el job se adjudica la fila:
    -- sin él, dos instancias podrían despachar el mismo mensaje.
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sending','sent','cancelled','failed')),
    -- Mensaje realmente creado al despachar; NULL mientras está pendiente.
    sent_message_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
    error            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El job barre por (status, scheduled_at); el listado del usuario, por remitente.
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON scheduled_messages (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sender
  ON scheduled_messages (sender_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS message_reminders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    remind_at        TIMESTAMPTZ NOT NULL,
    note             VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','done','cancelled')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reminders_due
  ON message_reminders (remind_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_message_reminders_user
  ON message_reminders (user_id, remind_at DESC);

COMMENT ON TABLE scheduled_messages IS 'Mensajes en espera de despacho automático (job scheduled-messages).';
COMMENT ON TABLE message_reminders  IS 'Avisos que un usuario se pone a sí mismo sobre un mensaje.';
