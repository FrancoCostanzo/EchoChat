/**
 * Backfill: cifra el contenido existente (texto plano) y construye el índice
 * ciego de búsqueda. Idempotente — saltea lo ya cifrado (prefijo "enc:").
 *
 * Requisitos previos:
 *   - MESSAGE_ENC_KEY configurada en .env.
 *   - Migración 007_message_encryption.sql ya aplicada (tabla de tokens creada).
 *
 * Uso:
 *   node scripts/encrypt-existing-messages.js
 */
const { pool } = require('../src/config/database');
const { encrypt, searchTokens } = require('../src/utils/crypto.util');

const isEncrypted = (v) => typeof v === 'string' && v.startsWith('enc:');

async function backfillColumn(table, idCol, col, label, idCast = '') {
  const { rows } = await pool.query(
    `SELECT ${idCol} AS id, ${col} AS val FROM ${table}
     WHERE ${col} IS NOT NULL AND ${col} NOT LIKE 'enc:%'`
  );
  let n = 0;
  for (const r of rows) {
    await pool.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2${idCast}`, [encrypt(r.val), r.id]);
    n++;
  }
  console.log(`  ${label}: ${n} fila(s) cifrada(s)`);
}

async function backfillMessageBodiesAndTokens() {
  // Mensajes con body en claro: cifrar + (re)construir tokens desde el texto plano.
  const { rows } = await pool.query(
    `SELECT id, body FROM messages WHERE body IS NOT NULL AND body NOT LIKE 'enc:%'`
  );
  let enc = 0;
  for (const r of rows) {
    const tokens = searchTokens(r.body);
    await pool.query('UPDATE messages SET body = $1 WHERE id = $2', [encrypt(r.body), r.id]);
    await pool.query('DELETE FROM message_search_tokens WHERE message_id = $1', [r.id]);
    if (tokens.length) {
      await pool.query(
        `INSERT INTO message_search_tokens (message_id, token)
         SELECT $1, t FROM unnest($2::text[]) AS t
         ON CONFLICT (message_id, token) DO NOTHING`,
        [r.id, tokens]
      );
    }
    enc++;
  }
  console.log(`  messages.body: ${enc} mensaje(s) cifrado(s) + tokens reconstruidos`);

  // Mensajes ya cifrados pero sin tokens (p. ej. si se corrió a medias): reindexar.
  // (Se omite por defecto; el bloque de arriba ya cubre el caso normal.)
}

(async () => {
  console.log('Backfill de cifrado de mensajes — iniciando...');
  try {
    await backfillMessageBodiesAndTokens();
    await backfillColumn('message_edits', 'id', 'body_before', 'message_edits.body_before');
    await backfillColumn('drafts', 'ctid', 'body', 'drafts.body', '::tid');
    await backfillColumn('saved_messages', 'ctid', 'note', 'saved_messages.note', '::tid');
    console.log('Backfill completado.');
  } catch (err) {
    console.error('ERROR en backfill:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
