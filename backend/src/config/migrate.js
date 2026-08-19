// =============================================================================
// Runner de migraciones + bootstrap del primer administrador.
//
// Este módulo es la ÚNICA fuente de verdad para dejar la base de datos lista:
//   1. Aplica el schema base (docs/messaging_intranet_schema.sql) si la BD está
//      vacía.
//   2. Aplica en orden las migraciones incrementales de docs/migrations/*.sql,
//      registrando cada una en la tabla `schema_migrations` para no repetirlas.
//   3. Crea el primer usuario super_admin a partir de ADMIN_USERNAME /
//      ADMIN_PASSWORD si todavía no existe ninguno.
//
// Se ejecuta automáticamente al arrancar el backend (ver server.js) y también
// de forma manual con `npm run migrate`.
//
// Idempotente: correrlo varias veces es seguro. En una BD que ya existía ANTES
// de este runner (sin `schema_migrations`) se hace un "baseline": se marcan
// todas las migraciones actuales como aplicadas SIN ejecutarlas, para no correr
// ALTERs contra datos en producción. En una BD nueva se ejecuta todo de cero.
// =============================================================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool, withTransaction } = require('./database');
const logger = require('./logger');

const SCHEMA_FILE = path.resolve(__dirname, '../../docs/messaging_intranet_schema.sql');
const SEED_FILE = path.resolve(__dirname, '../../docs/seed.sql');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../docs/migrations');
const BASE_MIGRATION = '000_base_schema';
const SALT_ROUNDS = 12;

// Códigos de error de PostgreSQL que significan "el objeto que crea esta
// migración ya existe" → la migración ya estaba aplicada de facto: la marcamos
// como aplicada y seguimos, en vez de abortar. Conservador a propósito: sólo
// duplicados de objetos, nunca violaciones de datos.
const ALREADY_APPLIED_CODES = new Set([
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42710', // duplicate_object (constraint, index, etc.)
  '42P06', // duplicate_schema
  '42723', // duplicate_function
]);

/**
 * Espera a que la base de datos esté disponible (reintenta ante arranques en
 * los que Postgres todavía no aceptó conexiones). Devuelve true si conectó.
 */
async function waitForDb({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      return true;
    } catch (err) {
      logger.warn(
        { attempt, retries, code: err.code },
        `Base de datos no disponible todavía, reintentando en ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    } finally {
      client?.release();
    }
  }
  return false;
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // orden lexicográfico = orden de aplicación (001, 002, ... 012)
}

/**
 * Aplica el schema base y todas las migraciones pendientes.
 * @returns {Promise<number>} cantidad de migraciones ejecutadas.
 */
async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const { rows } = await pool.query(`SELECT to_regclass('public.users') AS t`);
  const dbHasSchema = rows[0].t !== null;

  // ── Caso A: BD que ya tenía tablas ANTES de este runner ──────────────────
  // No podemos saber qué migraciones se corrieron a mano, así que adoptamos el
  // estado actual como baseline: marcamos todo como aplicado SIN ejecutarlo.
  if (dbHasSchema && !applied.has(BASE_MIGRATION)) {
    const files = listMigrationFiles();
    await withTransaction(async (c) => {
      await c.query(
        'INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING',
        [BASE_MIGRATION]
      );
      for (const file of files) {
        await c.query(
          'INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
      }
    });
    logger.warn(
      'Se detectó un esquema preexistente sin control de migraciones. Se marcaron ' +
        'todas las migraciones actuales como aplicadas SIN ejecutarlas (baseline). ' +
        'Si a esta BD le falta alguna columna/tabla reciente, aplique la migración ' +
        'correspondiente de backend/docs/migrations/ a mano.'
    );
    return 0;
  }

  // ── Caso B: BD nueva ─ aplicar schema base ───────────────────────────────
  if (!applied.has(BASE_MIGRATION)) {
    logger.info('Aplicando schema base...');
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await withTransaction(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [BASE_MIGRATION]);
    });
    applied.add(BASE_MIGRATION);
    logger.info('Schema base aplicado');
  }

  // ── Migraciones incrementales ────────────────────────────────────────────
  let count = 0;
  for (const file of listMigrationFiles()) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await withTransaction(async (c) => {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      });
      logger.info({ file }, 'Migración aplicada');
      count++;
    } catch (err) {
      if (ALREADY_APPLIED_CODES.has(err.code)) {
        await pool.query(
          'INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        logger.warn(
          { file, code: err.code },
          'Los objetos de la migración ya existían — marcada como aplicada'
        );
      } else {
        logger.error({ file, err }, 'Falló la migración');
        throw err;
      }
    }
  }
  return count;
}

/**
 * Aplica los datos de referencia (docs/seed.sql). Es idempotente
 * (ON CONFLICT DO NOTHING) y se corre en CADA arranque para converger: los
 * permisos/settings nuevos que se agreguen al seed llegan solos a instancias
 * existentes.
 */
async function applySeed() {
  const sql = fs.readFileSync(SEED_FILE, 'utf8');
  await withTransaction((c) => c.query(sql));
  logger.info('Datos de referencia (seed) aplicados');
}

/**
 * Crea el primer super_admin a partir de ADMIN_USERNAME / ADMIN_PASSWORD.
 * No hace nada si ya existe algún super_admin. Idempotente.
 */
async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS n
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'super_admin'
  `);
  if (rows[0].n > 0) {
    logger.info('Ya existe al menos un super_admin — se omite el bootstrap de admin');
    return;
  }

  if (!username || !password) {
    logger.warn(
      'No hay ningún super_admin y ADMIN_USERNAME/ADMIN_PASSWORD no están ' +
        'configurados. Defínalos en el .env para crear el primer administrador ' +
        'automáticamente, o cree uno a mano.'
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrador';
  const email = process.env.ADMIN_EMAIL || null;

  await withTransaction(async (c) => {
    const existing = await c.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      logger.info({ username }, 'El usuario admin ya existe — se le otorga super_admin');
    } else {
      const created = await c.query(
        `INSERT INTO users (username, display_name, email, auth_provider)
         VALUES ($1, $2, $3, 'local') RETURNING id`,
        [username, displayName, email]
      );
      userId = created.rows[0].id;
      await c.query(
        'INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
      );
      logger.info({ username }, 'Primer administrador creado');
    }
    await c.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'super_admin'
       ON CONFLICT DO NOTHING`,
      [userId]
    );
  });

  logger.warn(
    { username },
    '★ Primer administrador listo. Inicie sesión y cambie la contraseña cuanto antes.'
  );
}

/**
 * Orquestador: espera la BD, corre migraciones y crea el admin inicial.
 * Lanza error si la BD es inalcanzable o si una migración falla, para que el
 * proceso que lo invoca decida (el server aborta y deja que se reinicie).
 */
async function setup() {
  const ready = await waitForDb();
  if (!ready) {
    throw new Error('Base de datos inalcanzable tras varios reintentos');
  }
  const applied = await runMigrations();
  logger.info({ applied }, 'Base de datos al día');
  await applySeed();
  await bootstrapAdmin();
}

module.exports = { setup, runMigrations, applySeed, bootstrapAdmin, waitForDb };
