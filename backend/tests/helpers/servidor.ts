import http from 'http';
import type { AddressInfo } from 'net';
import config from '../../src/config';
import { setup } from '../../src/config/migrate';
import app from '../../src/app';
import { initSocket, closeSocket } from '../../src/socket';
import { pool } from '../../src/config/database';

export const ADMIN = { username: 'admin', password: 'Admin1234!' };
export const TOKEN_SCIM = 'token-scim-de-la-suite-de-tests';

export interface ServidorDeTest {
  /** URL base; el puerto lo asigna el sistema, así dos archivos no chocan. */
  base: string;
  cerrar: () => Promise<void>;
}

let arrancando: Promise<ServidorDeTest> | null = null;

/**
 * Levanta la app dentro del proceso de test, una sola vez por archivo. El
 * runner de Node corre cada archivo en su propio proceso, así que cada uno
 * tiene su instancia, su puerto y su ciclo de vida.
 */
export function levantarServidor(): Promise<ServidorDeTest> {
  if (!arrancando) arrancando = arrancar();
  return arrancando;
}

async function arrancar(): Promise<ServidorDeTest> {
  // Guarda: la suite crea usuarios, manda mensajes y suspende cuentas. Correrla
  // contra la base de desarrollo la ensuciaría sin aviso.
  if (config.db.database !== process.env.TEST_DB_NAME) {
    throw new Error(
      `Los tests sólo corren contra "${process.env.TEST_DB_NAME}" y config apunta `
      + `a "${config.db.database}". Falta el preload tests/entorno.ts.`,
    );
  }

  await setup();

  const server = http.createServer(app);
  await initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    cerrar: async () => {
      await closeSocket();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}
