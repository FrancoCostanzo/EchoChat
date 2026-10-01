-- Preferencias de notificación en tres niveles.
--
-- Hasta acá sólo existía `notification_preferences` (una fila por evento) y el
-- horario de silencio se guardaba repetido en cada una de esas filas. Este
-- cambio separa lo que es del usuario en general de lo que es de cada evento:
--
--   · user_notification_settings  — global del usuario: no molestar, horario y
--                                   días de silencio, sonidos, privacidad del
--                                   push y preferencias de email.
--   · notification_preferences    — por evento (in-app / push / email); pierde
--                                   las columnas de horario, que se mudan acá.
--   · conversation_members        — por chat: `notification_level` se suma a
--                                   `is_muted`/`muted_until`, que ya existían.
--
-- Idempotente: se puede correr varias veces sin efectos.

CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id                    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- No molestar manual. `dnd_until` NULL con `dnd_enabled` = hasta desactivarlo.
    dnd_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
    dnd_until                  TIMESTAMPTZ,

    -- Franja diaria de silencio (puede cruzar la medianoche) y días completos
    -- sin avisos (0 = domingo … 6 = sábado). Se evalúan en users.timezone.
    quiet_hours_start          TIME,
    quiet_hours_end            TIME,
    quiet_days                 SMALLINT[] NOT NULL DEFAULT '{}',

    -- Qué muestra una notificación push y cuándo se manda.
    push_preview               VARCHAR(10) NOT NULL DEFAULT 'full'
                               CHECK (push_preview IN ('full', 'sender', 'none')),
    push_when                  VARCHAR(10) NOT NULL DEFAULT 'inactive'
                               CHECK (push_when IN ('always', 'inactive')),

    -- Sonidos (se sintetizan en el cliente; acá sólo va el nombre).
    sound_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    sound_name                 VARCHAR(30) NOT NULL DEFAULT 'ping',
    sound_volume               SMALLINT NOT NULL DEFAULT 70 CHECK (sound_volume BETWEEN 0 AND 100),
    ringtone_name              VARCHAR(30) NOT NULL DEFAULT 'classic',
    badge_enabled              BOOLEAN NOT NULL DEFAULT TRUE,

    -- Email: resumen periódico, aviso de pendientes sin leer e idioma.
    email_digest               VARCHAR(10) NOT NULL DEFAULT 'off'
                               CHECK (email_digest IN ('off', 'hourly', 'daily', 'weekly')),
    email_digest_hour          SMALLINT NOT NULL DEFAULT 9 CHECK (email_digest_hour BETWEEN 0 AND 23),
    email_unread_delay_minutes SMALLINT NOT NULL DEFAULT 30
                               CHECK (email_unread_delay_minutes IN (15, 30, 60, 120)),
    email_locale               VARCHAR(10),

    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_notification_settings IS
  'Preferencias globales de notificación de cada usuario. Sin fila = valores por defecto.';

-- Mudar el horario de silencio que ya estaba configurado (era el mismo en
-- todas las filas del usuario: se toma cualquiera) y borrar las columnas viejas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'quiet_hours_start'
  ) THEN
    INSERT INTO user_notification_settings (user_id, quiet_hours_start, quiet_hours_end)
    SELECT DISTINCT ON (user_id) user_id, quiet_hours_start, quiet_hours_end
    FROM notification_preferences
    WHERE quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL
    ORDER BY user_id
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS quiet_hours_start,
  DROP COLUMN IF EXISTS quiet_hours_end,
  DROP COLUMN IF EXISTS quiet_days;

-- Nivel de aviso por chat: todos los mensajes, sólo menciones o nada.
ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS notification_level VARCHAR(10) NOT NULL DEFAULT 'all'
    CHECK (notification_level IN ('all', 'mentions', 'none'));

COMMENT ON COLUMN conversation_members.notification_level IS
  'all = todo; mentions = sólo menciones; none = nada (ni menciones). is_muted silencia todo menos menciones.';
