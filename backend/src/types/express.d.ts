import type { Row } from './rows';

/**
 * Lo que los middlewares cuelgan del request.
 *
 * Van todas opcionales porque en el tipo de Express no hay forma de expresar
 * "esta ruta ya pasó por `authenticate`": el router lo garantiza, el tipo no.
 * Las rutas autenticadas usan `AuthRequest` (ver abajo), que es donde esa
 * garantía se hace explícita en vez de darse por sentada en 100 lugares.
 */
declare global {
  namespace Express {
    interface Request {
      user?: Row<'users'>;
      session?: Row<'user_sessions'>;
      /** Nombres de rol, cargados por `loadRbac`. */
      roles?: string[];
      /** Códigos de permiso, cargados por `loadRbac`. */
      permissions?: string[];
      /** Marca para no reconsultar RBAC dos veces en el mismo request. */
      _rbacLoaded?: boolean;
    }
  }
}

export {};
