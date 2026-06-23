-- =============================================================================
-- MIGRACIÓN 007 — Cifrado de mensajes en reposo + índice ciego de búsqueda
--
-- Contexto:
--   Hasta ahora el contenido de los mensajes (messages.body, drafts.body,
--   saved_messages.note, message_edits.body_before) se guardaba en TEXTO PLANO.
--   Esta migración prepara la base para cifrarlo con AES-256-GCM a nivel de
--   aplicación (el servidor mantiene la clave: ver MESSAGE_ENC_KEY en .env).
--
--   El texto cifrado se almacena en las MISMAS columnas TEXT (formato
--   "enc:<keyId>:<iv>:<tag>:<ciphertext>"), por lo que no cambian los tipos.
--
-- Búsqueda:
--   El full-text search en español dependía de messages.search_vector (TSVECTOR),
--   que filtra el contenido en claro. Lo reemplazamos por un ÍNDICE CIEGO:
--   message_search_tokens guarda HMAC-SHA256 de cada token normalizado del body.
--   La búsqueda server-side sigue funcionando (igualdad por token, semántica AND)
--   sin exponer el texto. Se pierde ranking y stemming.
--
-- Pasos posteriores OBLIGATORIOS:
--   1. Configurar MESSAGE_ENC_KEY en .env (32 bytes base64).
--   2. Desplegar el código (decrypt() hace passthrough de texto plano heredado,
--      así que la app sigue leyendo lo viejo sin romperse).
--   3. Cifrar lo existente y construir el índice:
--        node scripts/encrypt-existing-messages.js
--
-- Idempotente. Ejecutar con:
--   psql -U postgres -d EchoChat -f 007_message_encryption.sql
-- =============================================================================

-- 1. Índice ciego de búsqueda -------------------------------------------------
CREATE TABLE IF NOT EXISTS message_search_tokens (
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,   -- HMAC-SHA256(searchKey, token_normalizado) en hex
    PRIMARY KEY (message_id, token)
);

-- Lookup por token (lado izquierdo del JOIN de búsqueda).
CREATE INDEX IF NOT EXISTS idx_message_search_tokens_token
    ON message_search_tokens (token);

-- 2. Desactivar el full-text search en claro ----------------------------------
-- El trigger poblaba search_vector con to_tsvector(body); con el body cifrado ya
-- no aporta y dejaría lexemas derivados de ciphertext. Lo eliminamos.
DROP TRIGGER IF EXISTS trg_messages_search_vector ON messages;
DROP FUNCTION IF EXISTS fn_update_message_search_vector();
DROP INDEX IF EXISTS idx_messages_search;

-- La columna messages.search_vector se deja por compatibilidad (no se usa).
-- Para liberar espacio, opcionalmente:
--   ALTER TABLE messages DROP COLUMN search_vector;
