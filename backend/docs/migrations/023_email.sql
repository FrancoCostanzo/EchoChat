-- Canal email: cola de envío, tokens de un solo uso (recuperar contraseña e
-- invitación) y las marcas que evitan mandar dos veces el mismo aviso.
--
-- Idempotente: se puede correr varias veces sin efectos.

-- Cola: los requests encolan y un job manda con reintentos. Así nadie espera al
-- SMTP y un reinicio del backend no pierde emails.
CREATE TABLE IF NOT EXISTS email_outbox (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    to_address    VARCHAR(255) NOT NULL,
    template      VARCHAR(50) NOT NULL,
    locale        VARCHAR(10) NOT NULL DEFAULT 'es',
    -- Datos para armar el email. Nunca contenido de mensajes (van cifrados en
    -- reposo); los links con token sí, por eso `data` se vacía al enviarse.
    data          JSONB NOT NULL DEFAULT '{}',
    status        VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
    attempts      SMALLINT NOT NULL DEFAULT 0,
    send_after    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at       TIMESTAMPTZ,
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox (send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox (created_at DESC);

-- Tokens de un solo uso para definir contraseña: recuperación (30 min) e
-- invitación de una cuenta creada por el admin (72 h). Se guarda el hash.
CREATE TABLE IF NOT EXISTS password_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    purpose     VARCHAR(10) NOT NULL CHECK (purpose IN ('reset', 'invite')),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_tokens_user ON password_tokens (user_id);

-- Aviso por email de una notificación que sigue sin leer: cuándo vence la
-- espera y cuándo se mandó (para no repetir).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS email_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emailed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_email_due
  ON notifications (email_due_at) WHERE email_due_at IS NOT NULL AND emailed_at IS NULL;

-- Mensajes sin leer de un chat: un solo email por "racha" (hasta que lo lea).
ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS unread_email_at TIMESTAMPTZ;

-- Último resumen periódico enviado.
ALTER TABLE user_notification_settings
  ADD COLUMN IF NOT EXISTS last_digest_at TIMESTAMPTZ;
