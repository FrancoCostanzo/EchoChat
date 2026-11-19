// =============================================================================
// Migraciones HISTÓRICAS en .sql (sólo PostgreSQL, congeladas).
//
// Antes de pasar a Kysely (docs/MULTI_DB.md, etapa 1) el esquema se armaba con
// docs/messaging_intranet_schema.sql + docs/migrations/NNN_*.sql, registrados en
// `schema_migrations`. Todo eso equivale a la migración TS `001_initial`.
//
// Este módulo existe sólo para que una base creada con ese sistema termine de
// aplicar las migraciones .sql que le falten antes de pasar al nuevo. No se
// agregan archivos nuevos acá: los cambios de esquema van en migrations/*.ts.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { sql, type Kysely } from 'kysely';
import { pool, withTransaction } from '../database';
import logger from '../logger';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../docs/migrations');
const BASE_MIGRATION = '000_base_schema';

// Códigos de PostgreSQL que significan "el objeto ya existe": la migración ya
// estaba aplicada de facto. Sólo duplicados de objetos, nunca errores de datos.
const ALREADY_APPLIED_CODES = new Set(['42P07', '42701', '42710', '42P06', '42723']);
const pgCode = (err: unknown): string | undefined => (err as { code?: string })?.code;

function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** `true` si la base tiene tablas creadas por el sistema viejo. */
export async function hasLegacySchema(db: Kysely<any>): Promise<boolean> {
  const tables = await db.introspection.getTables();
  return tables.some((t) => t.name === 'users');
}

/**
 * Pone al día una base del sistema viejo: aplica las migraciones .sql que le
 * falten. Si la base es anterior incluso a `schema_migrations`, adopta el estado
 * actual como baseline (comportamiento histórico, sin ejecutar nada).
 */
export async function upgradeLegacySchema(db: Kysely<any>): Promise<number> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await sql<{ name: string }>`SELECT name FROM schema_migrations`.execute(db);
  const applied = new Set(rows.map((r) => r.name));
  const files = listMigrationFiles();

  if (!applied.has(BASE_MIGRATION)) {
    await withTransaction(async (c) => {
      for (const name of [BASE_MIGRATION, ...files]) {
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
      }
    });
    logger.warn(
      'Se detectó un esquema preexistente sin control de migraciones. Se marcaron ' +
        'todas las migraciones como aplicadas SIN ejecutarlas (baseline). Si a esta BD ' +
        'le falta alguna columna/tabla reciente, aplique la migración correspondiente ' +
        'de backend/docs/migrations/ a mano.',
    );
    return 0;
  }

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await withTransaction(async (c) => {
        await c.query(text);
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      });
      logger.info({ file }, 'Migración histórica aplicada');
      count++;
    } catch (err) {
      const code = pgCode(err);
      if (!code || !ALREADY_APPLIED_CODES.has(code)) {
        logger.error({ file, err }, 'Falló la migración histórica');
        throw err;
      }
      await pool.query('INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      logger.warn({ file, code }, 'Los objetos de la migración ya existían — marcada como aplicada');
    }
  }
  return count;
}
