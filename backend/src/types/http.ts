import type { Request, Response, RequestHandler } from 'express';
import type { Row } from './rows';

/**
 * Request de una ruta que ya pasó por `authenticate`, que tira 401 si no hay
 * sesión válida. Es el tipo que usan los controllers: convierte en una sola
 * afirmación —hecha en el router, donde la garantía existe— lo que si no sería
 * un `!` repetido en cada acceso a `req.user`.
 */
export interface AuthRequest extends Request {
  user: Row<'users'>;
  session: Row<'user_sessions'>;
}

/**
 * Adapta un handler que espera `AuthRequest` a lo que pide el Router.
 *
 * Es el único punto donde se afirma que `req.user` existe, y se escribe en el
 * router, que es donde la garantía se ve: sólo se usa detrás de `authenticate`.
 * Devuelve la promesa del handler para que `express-async-errors` siga
 * capturando los rechazos, igual que con los arrows sueltos de antes.
 */
export function withAuth(
  handler: (req: AuthRequest, res: Response) => unknown,
): RequestHandler {
  return (req, res) => handler(req as AuthRequest, res);
}

/**
 * Lee un parámetro de query como string. Express tipa cada valor como
 * `string | string[] | ParsedQs | ParsedQs[]` porque `?a=1&a=2` y `?a[b]=1`
 * son válidos; los controllers siempre esperan el caso simple.
 */
export function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Lee un parámetro numérico. Sólo aplica el valor por defecto cuando el
 * parámetro no vino, igual que hacía el `= 20` de la desestructuración: un
 * valor presente pero no numérico sigue dando NaN, como antes.
 */
export function qInt(v: unknown, porDefecto: number): number {
  if (v === undefined) return porDefecto;
  return parseInt(String(v), 10);
}

/**
 * El otro patrón que hay en el código: `parseInt(q, 10) || porDefecto`. A
 * diferencia de `qInt`, acá un valor no numérico —y también el 0— caen al
 * valor por defecto. Se conservan los dos porque los llamadores usaban uno u
 * otro y no son equivalentes.
 */
export function qIntOr(v: unknown, porDefecto: number): number {
  return parseInt(String(v ?? ''), 10) || porDefecto;
}
