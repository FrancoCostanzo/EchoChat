-- Suscripciones de Web Push: una por navegador/dispositivo donde el usuario
-- activó las notificaciones. `endpoint` es la URL del servicio de push del
-- navegador (FCM, Mozilla, Apple) y es única: si el mismo navegador se vuelve
-- a suscribir con otra cuenta, la fila pasa a la cuenta nueva.
--
-- Idempotente: se puede correr varias veces sin efectos.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint       TEXT NOT NULL UNIQUE,
    -- Claves de cifrado del payload que entrega el navegador al suscribirse.
    p256dh         TEXT NOT NULL,
    auth           TEXT NOT NULL,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at   TIMESTAMPTZ,
    -- Envíos fallidos seguidos (no 404/410, que borran la fila al instante).
    failure_count  SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

COMMENT ON TABLE push_subscriptions IS 'Navegadores/dispositivos suscriptos a Web Push de cada usuario.';
