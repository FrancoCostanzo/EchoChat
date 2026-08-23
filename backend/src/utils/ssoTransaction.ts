import jwt from 'jsonwebtoken';
import type { CookieOptions, Request, Response } from 'express';
import config from '../config';

// Guarda el material efímero de una transacción OIDC (state/nonce/PKCE) entre el
// redirect al IdP y el callback. Va en una cookie httpOnly firmada de corta vida:
// no requiere estado en el servidor y sobrevive reinicios / múltiples instancias.
const COOKIE_NAME = 'echo_sso';
const COOKIE_PATH = '/api/auth/sso';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

function _cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax', // se envía en la navegación top-level de vuelta del IdP
    path: COOKIE_PATH,
    maxAge: MAX_AGE_MS,
  };
}

/**
 * Material efímero de una transacción OIDC. Lo declara este módulo, que es el
 * que decide el formato de la cookie; `oidc.service` lo importa de acá.
 */
export interface SsoTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function setTransaction(res: Response, transaction: SsoTransaction): void {
  // `config.jwt.secret` es `string | undefined` porque sale del entorno: sin
  // JWT_SECRET la app no puede funcionar y esto revienta, igual que antes.
  const token = jwt.sign(transaction, config.jwt.secret as jwt.Secret, { expiresIn: '10m' });
  res.cookie(COOKIE_NAME, token, _cookieOptions());
}

/**
 * Lee la cookie (parseando el header, sin cookie-parser), la verifica y la borra.
 * Devuelve la transacción o null si falta, está expirada o es inválida.
 *
 * El genérico lo fija quien llama, que es el que sabe qué guardó. Además se
 * descarta el caso en que `jwt.verify` devuelve un string: sólo se acepta un
 * payload de objeto, que es lo único que `setTransaction` puede haber escrito.
 */
export function readAndClearTransaction<T extends object = SsoTransaction>(req: Request, res: Response): T | null {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
  if (!match) return null;
  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  try {
    const payload = jwt.verify(value, config.jwt.secret as jwt.Secret);
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as T;
  } catch {
    return null;
  }
}
