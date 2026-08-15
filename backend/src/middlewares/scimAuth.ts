import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import config from '../config';
import { scimError } from '../utils/scim';

// Comparación en tiempo constante para no filtrar el token por timing.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a || '', 'utf8');
  const bb = Buffer.from(b || '', 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Autentica a los clientes SCIM (Okta/Azure) por un bearer token estático,
// independiente del JWT de sesión de los usuarios de la app.
function scimAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.scim.enabled || !config.scim.token) {
    return scimError(res, 403, 'El aprovisionamiento SCIM no está habilitado');
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || !safeEqual(token, config.scim.token)) {
    return scimError(res, 401, 'Token SCIM inválido');
  }
  next();
}

export = scimAuth;
