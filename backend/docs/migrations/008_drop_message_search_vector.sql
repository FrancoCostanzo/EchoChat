-- =============================================================================
-- MIGRACIÓN 008 — Eliminar messages.search_vector (columna muerta)
--
-- Tras la migración 007 el full-text search en claro quedó desactivado (trigger
-- e índice eliminados) y la búsqueda usa el índice ciego message_search_tokens.
-- La columna search_vector ya no se usa en ningún lado; la quitamos.
--
-- Idempotente. Ejecutar con:
--   psql -U postgres -d EchoChat -f 008_drop_message_search_vector.sql
-- =============================================================================

ALTER TABLE messages DROP COLUMN IF EXISTS search_vector;
