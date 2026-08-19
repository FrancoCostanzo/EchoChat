import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import type { Cliente } from './api';
import { sufijo } from './api';

/** Generador TOTP con los mismos plugins que usa el backend. */
export const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

export const CLAVE = 'PruebaSuite123!';

export interface UsuarioDeTest {
  id: string;
  username: string;
  token: string;
}

/** Registra un usuario nuevo y devuelve su sesión ya iniciada. */
export async function crearUsuario(pedir: Cliente, prefijo = 'u'): Promise<UsuarioDeTest> {
  const username = prefijo + sufijo();
  const alta = await pedir('/api/auth/register', {
    method: 'POST',
    body: { username, display_name: username, password: CLAVE },
  });
  if (alta.status !== 201) {
    throw new Error(`no se pudo registrar ${username}: ${alta.status} ${alta.texto.slice(0, 200)}`);
  }
  return iniciarSesion(pedir, username);
}

export async function iniciarSesion(pedir: Cliente, username: string, clave = CLAVE): Promise<UsuarioDeTest> {
  const r = await pedir('/api/auth/login', { method: 'POST', body: { username, password: clave } });
  if (r.status !== 200 || !r.datos?.token) {
    throw new Error(`no se pudo iniciar sesión con ${username}: ${r.status} ${r.texto.slice(0, 200)}`);
  }
  return { id: r.datos.user.id, username, token: r.datos.token };
}

/** Activa 2FA y devuelve el secreto y los códigos de respaldo recién emitidos. */
export async function activar2fa(pedir: Cliente, token: string) {
  const setup = await pedir('/api/auth/2fa/setup', { method: 'POST', token });
  const secreto: string = setup.datos.secret;
  const alta = await pedir('/api/auth/2fa/enable', {
    method: 'POST',
    token,
    body: { code: await totp.generate({ secret: secreto }) },
  });
  if (alta.status !== 200) {
    throw new Error(`no se pudo activar 2FA: ${alta.status} ${alta.texto.slice(0, 200)}`);
  }
  return { secreto, codigosDeRespaldo: alta.datos.backup_codes as string[], qr: setup.datos.qr_code as string };
}
