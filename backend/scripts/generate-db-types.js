#!/usr/bin/env node
/**
 * Regenera src/types/db.d.ts a partir del schema del proyecto.
 *
 * Levanta una PostgreSQL efímera en Docker, le aplica el schema base + las
 * migraciones con el propio migrador (src/cli/setup.js) y la introspecciona.
 * Se hace así, y no contra la base de desarrollo, porque los tipos tienen que
 * reflejar el schema commiteado: una base local puede haber quedado con
 * columnas de una rama vieja o con migraciones a medias.
 *
 * Uso:  npm run db:types
 *
 * Si prefiere apuntar a una base ya existente:
 *   DATABASE_URL=postgres://user:pass@host:5432/db npm run db:types
 */

const { execFileSync, execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const CONTENEDOR = 'echochat-tipos-tmp';
const PUERTO = process.env.TYPEGEN_PORT || '5433';
const PASSWORD = 'tipos';
const SALIDA = path.join(__dirname, '..', 'src', 'types', 'db.d.ts');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });

// Espera sincrónica sin depender del shell: `timeout` de Windows falla cuando
// se le redirige la entrada, y `sleep` no existe ahí.
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function limpiar() {
  try {
    execSync(`docker rm -f ${CONTENEDOR}`, { stdio: 'ignore' });
  } catch {
    // no existía
  }
}

function generar(url) {
  run('npx', ['kysely-codegen', '--dialect', 'postgres', '--url', `"${url}"`, '--out-file', `"${SALIDA}"`]);
}

if (process.env.DATABASE_URL) {
  console.log('Usando DATABASE_URL existente.');
  generar(process.env.DATABASE_URL);
  process.exit(0);
}

limpiar();
try {
  console.log(`Levantando PostgreSQL efímera en el puerto ${PUERTO}...`);
  run('docker', [
    'run', '-d', '--name', CONTENEDOR,
    '-e', `POSTGRES_PASSWORD=${PASSWORD}`,
    '-e', 'POSTGRES_USER=echochat',
    '-e', 'POSTGRES_DB=echochat',
    '-p', `${PUERTO}:5432`,
    'postgres:17-alpine',
  ], { stdio: 'ignore' });

  process.stdout.write('Esperando a que acepte conexiones');
  for (let intento = 0; ; intento++) {
    try {
      execSync(`docker exec ${CONTENEDOR} pg_isready -U echochat -d echochat`, { stdio: 'ignore' });
      break;
    } catch {
      if (intento > 30) throw new Error('la base efímera no arrancó');
      process.stdout.write('.');
      dormir(1000);
    }
  }
  console.log(' listo.');

  console.log('Aplicando schema y migraciones...');
  // Vía tsx y no node: el grafo de módulos ya incluye archivos .ts, que Node no
  // puede cargar directamente.
  run('npx', ['tsx', path.join(__dirname, '..', 'src', 'cli', 'setup.js')], {
    stdio: 'ignore',
    env: {
      ...process.env,
      DB_HOST: 'localhost',
      DB_PORT: PUERTO,
      DB_NAME: 'echochat',
      DB_USER: 'echochat',
      DB_PASSWORD: PASSWORD,
      // Requeridas por config, irrelevantes para introspeccionar el schema.
      MESSAGE_ENC_KEY: crypto.randomBytes(32).toString('base64'),
      ADMIN_USERNAME: '',
      ADMIN_PASSWORD: '',
    },
  });

  console.log('Introspeccionando...');
  generar(`postgres://echochat:${PASSWORD}@localhost:${PUERTO}/echochat`);
  console.log(`\nListo: ${path.relative(process.cwd(), SALIDA)}`);
} finally {
  limpiar();
}
