-- Un chat (directo o grupal) solo puede tener un mensaje fijado a la vez,
-- visible para todos sus miembros. Antes `pinned_messages` permitía varias
-- filas por conversación; esto deja una sola (la fijada más recientemente)
-- y agrega el índice único que impide que se vuelva a duplicar.
--
-- Idempotente: se puede correr varias veces sin efectos.

DELETE FROM pinned_messages pm
USING pinned_messages pm2
WHERE pm.conversation_id = pm2.conversation_id
  AND (pm.pinned_at, pm.message_id) < (pm2.pinned_at, pm2.message_id);

CREATE UNIQUE INDEX IF NOT EXISTS pinned_messages_conversation_id_key
  ON pinned_messages (conversation_id);
