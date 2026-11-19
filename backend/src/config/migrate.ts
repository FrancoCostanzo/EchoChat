// =============================================================================
// Runner de migraciones + bootstrap del primer administrador.
//
// Este módulo es la ÚNICA fuente de verdad para dejar la base de datos lista:
//   1. Aplica las migraciones de esquema (src/config/db/migrations/*.ts, con el
//      schema builder de Kysely), registradas en `kysely_migration`.
//   2. Aplica los datos de referencia (src/config/db/seed.ts) en cada arranque,
//      para converger.
//   3. Crea el primer usuario super_admin a partir de ADMIN_USERNAME /
//      ADMIN_PASSWORD si todavía no existe ninguno.
//
// Se ejecuta automáticamente al arrancar el backend (ver server.ts) y también
// de forma manual con `npm run migrate`.
//
// Bases anteriores a Kysely (PostgreSQL con schema_migrations): primero se
// terminan de aplicar las migraciones .sql históricas que falten y después se
// marca `001_initial` como aplicada sin ejecutarla, porque es el mismo esquema.
// Ver docs/MULTI_DB.md.
// =============================================================================

import bcrypt from 'bcrypt';
import { sql } from 'kysely';
import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import { pool } from './database';
import { db } from './db';
import { migrations, INITIAL_MIGRATION } from './db/migrations';
import { hasLegacySchema, upgradeLegacySchema } from './db/legacyMigrations';
import { runSeed } from './db/seed';
import { isPostgres } from './db/schema';
import logger from './logger';

const SALT_ROUNDS = 12;

// Clave del advisory lock que serializa setup() entre instancias (PostgreSQL).
// Es un número arbitrario pero estable: todas las instancias deben usar el mismo.
const SETUP_LOCK_ID = 918273645;

/**
 * Espera a que la base de datos esté disponible (reintenta ante arranques en
 * los que el servidor todavía no aceptó conexiones). Devuelve true si conectó.
 */
export async function waitForDb({ retries = 30, delayMs = 2000 } = {}): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sql`SELECT 1`.execute(db);
      return true;
    } catch (err) {
      logger.warn(
        { attempt, retries, code: (err as { code?: string })?.code },
        `Base de datos no disponible todavía, reintentando en ${delayMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

function migrator(list: Record<string, Migration>): Migrator {
  return new Migrator({ db, provider: { getMigrations: async () => list } });
}

function check({ error, results }: MigrationResultSet, log = true): number {
  for (const r of results ?? []) {
    if (log && r.status === 'Success') logger.info({ migration: r.migrationName }, 'Migración aplicada');
    if (r.status === 'Error') logger.error({ migration: r.migrationName }, 'Falló la migración');
  }
  if (error) throw error;
  return (results ?? []).filter((r) => r.status === 'Success').length;
}

/** `true` si `001_initial` ya figura en la tabla de Kysely. */
async function initialApplied(): Promise<boolean> {
  const info = await migrator(migrations).getMigrations();
  return info.some((m) => m.name === INITIAL_MIGRATION && m.executedAt);
}

/**
 * Aplica todas las migraciones pendientes.
 * @returns cantidad de migraciones ejecutadas.
 */
export async function runMigrations(): Promise<number> {
  let count = 0;

  if (isPostgres() && !(await initialApplied()) && (await hasLegacySchema(db))) {
    count += await upgradeLegacySchema(db);
    // Mismo esquema que 001_initial: se registra sin ejecutarla.
    check(await migrator({ [INITIAL_MIGRATION]: { up: async () => {} } }).migrateTo(INITIAL_MIGRATION), false);
    logger.info('Base anterior a Kysely: 001_initial marcada como aplicada (baseline)');
  }

  count += check(await migrator(migrations).migrateToLatest());
  return count;
}

/** Aplica los datos de referencia (seed.ts). Idempotente; corre en CADA arranque. */
export async function applySeed(): Promise<void> {
  await runSeed(db);
  logger.info('Datos de referencia (seed) aplicados');
}

/**
 * Crea el primer super_admin a partir de ADMIN_USERNAME / ADMIN_PASSWORD.
 * No hace nada si ya existe algún super_admin. Idempotente.
 */
export async function bootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  const { n } = await db.selectFrom('user_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('r.name', '=', 'super_admin')
    .executeTakeFirstOrThrow();
  if (Number(n) > 0) {
    logger.info('Ya existe al menos un super_admin — se omite el bootstrap de admin');
    return;
  }

  if (!username || !password) {
    logger.warn(
      'No hay ningún super_admin y ADMIN_USERNAME/ADMIN_PASSWORD no están ' +
        'configurados. Defínalos en el .env para crear el primer administrador ' +
        'automáticamente, o cree uno a mano.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrador';
  const email = process.env.ADMIN_EMAIL || null;

  await db.transaction().execute(async (trx) => {
    const existing = await trx.selectFrom('users').select('id').where('username', '=', username).executeTakeFirst();
    let userId: string;
    if (existing) {
      userId = existing.id;
      logger.info({ username }, 'El usuario admin ya existe — se le otorga super_admin');
    } else {
      const created = await trx.insertInto('users')
        .values({ username, display_name: displayName, email, auth_provider: 'local' })
        .returning('id')
        .executeTakeFirstOrThrow();
      userId = created.id;
      await trx.insertInto('user_credentials').values({ user_id: userId, password_hash: passwordHash }).execute();
      logger.info({ username }, 'Primer administrador creado');
    }
    await trx.insertInto('user_roles')
      .columns(['user_id', 'role_id'])
      .expression((eb) => eb.selectFrom('roles as r')
        .select([eb.val(userId).as('user_id'), 'r.id'])
        .where('r.name', '=', 'super_admin')
        .where(({ not, exists, selectFrom }) => not(exists(selectFrom('user_roles as ur').select('ur.user_id')
          .where('ur.user_id', '=', userId).whereRef('ur.role_id', '=', 'r.id')))))
      .$if(isPostgres(), (q) => q.onConflict((oc) => oc.doNothing()))
      .execute();
  });

  logger.warn(
    { username },
    '★ Primer administrador listo. Inicie sesión y cambie la contraseña cuanto antes.',
  );
}

async function migrateSeedAndBootstrap(): Promise<void> {
  const applied = await runMigrations();
  logger.info({ applied }, 'Base de datos al día');
  await applySeed();
  await bootstrapAdmin();
}

/**
 * Orquestador: espera la BD, corre migraciones y crea el admin inicial.
 * Lanza error si la BD es inalcanzable o si una migración falla, para que el
 * proceso que lo invoca decida (el server aborta y deja que se reinicie).
 */
export async function setup(): Promise<void> {
  const ready = await waitForDb();
  if (!ready) {
    throw new Error('Base de datos inalcanzable tras varios reintentos');
  }

  if (!isPostgres()) {
    // El Migrator de Kysely ya serializa las migraciones con su propia tabla de lock.
    await migrateSeedAndBootstrap();
    return;
  }

  // Advisory lock de sesión: si arrancan N instancias a la vez, una aplica el
  // esquema y el resto espera acá en lugar de competir por el mismo DDL.
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SETUP_LOCK_ID]);
    await migrateSeedAndBootstrap();
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [SETUP_LOCK_ID]);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'No se pudo liberar el advisory lock de setup');
    }
    client.release();
  }
}
