// Las columnas array de PostgreSQL (TEXT[], SMALLINT[], UUID[]) pasan a JSON,
// que existe en todos los motores (docs/MULTI_DB.md, etapa 3). Los datos se
// convierten tal cual: '{a,b}' → ["a","b"]. Nulabilidad y defaults se conservan
// (el default vacío pasa de '{}' a '[]').
import { sql, type Kysely } from 'kysely';
import { onPostgres } from '../schema';

const COLUMNS: { table: string; column: string; emptyDefault: boolean }[] = [
  { table: 'user_credentials', column: 'totp_backup_codes', emptyDefault: true },
  { table: 'user_stickers', column: 'keywords', emptyDefault: true },
  { table: 'user_notification_settings', column: 'quiet_days', emptyDefault: true },
  { table: 'call_recordings', column: 'consented_by', emptyDefault: false },
];

export async function up(db: Kysely<any>): Promise<void> {
  // En los demás motores `t.array()` ya crea estas columnas como JSON.
  await onPostgres(db, async (db) => {
    // El índice GIN de keywords es de arrays (array_ops): no admite el cambio
    // de tipo. Se recrea sobre el JSON al final.
    await sql`DROP INDEX IF EXISTS idx_user_stickers_keywords`.execute(db);

    for (const { table, column, emptyDefault } of COLUMNS) {
      const t = sql.table(table);
      const c = sql.ref(column);
      await sql`ALTER TABLE ${t} ALTER COLUMN ${c} DROP DEFAULT`.execute(db);
      await sql`ALTER TABLE ${t} ALTER COLUMN ${c} TYPE jsonb USING to_jsonb(${c})`.execute(db);
      if (emptyDefault) {
        await sql`ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT '[]'::jsonb`.execute(db);
      }
    }

    await sql`CREATE INDEX idx_user_stickers_keywords ON user_stickers USING gin (keywords)`.execute(db);
  });
}
