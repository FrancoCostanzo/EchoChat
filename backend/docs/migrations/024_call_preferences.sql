-- Preferencias de llamadas del usuario. Los dispositivos (micrófono, cámara,
-- parlante) no van acá: sus ids son de cada navegador y se guardan en él.
--
-- Idempotente: se puede correr varias veces sin efectos.

ALTER TABLE user_notification_settings
  -- Quién puede llamarme: todos, sólo mis contactos (o favoritos), o nadie.
  ADD COLUMN IF NOT EXISTS call_privacy VARCHAR(10) NOT NULL DEFAULT 'everyone'
    CHECK (call_privacy IN ('everyone', 'contacts', 'nobody')),
  -- Con no molestar / horario de silencio: rechazar como ocupado, o sonar sin sonido.
  ADD COLUMN IF NOT EXISTS call_dnd_behavior VARCHAR(10) NOT NULL DEFAULT 'silent'
    CHECK (call_dnd_behavior IN ('reject', 'silent')),
  ADD COLUMN IF NOT EXISTS ringtone_volume SMALLINT NOT NULL DEFAULT 80
    CHECK (ringtone_volume BETWEEN 0 AND 100),
  -- Al entrar a una llamada.
  ADD COLUMN IF NOT EXISTS join_muted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS join_camera_off BOOLEAN NOT NULL DEFAULT FALSE,
  -- Procesamiento de audio del navegador (getUserMedia).
  ADD COLUMN IF NOT EXISTS noise_suppression BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS echo_cancellation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_gain_control BOOLEAN NOT NULL DEFAULT TRUE;
