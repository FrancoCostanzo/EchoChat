import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { userRepository } from '../repositories';
import { ForbiddenError, UnauthorizedError } from '../errors';

/** Request con el RBAC ya resuelto: lo devuelve `loadRbac`. */
export interface RbacRequest extends Request {
  permissions: string[];
  roles: string[];
}

// Lazily load the user's roles + permissions onto the request once per request.
// Must run after `authenticate` (which sets req.user).
async function loadRbac(req: Request): Promise<RbacRequest> {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  if (!req._rbacLoaded) {
    const [permissions, roles] = await Promise.all([
      userRepository.getPermissionCodes(req.user.id),
      userRepository.getRoleNames(req.user.id),
    ]);
    req.permissions = permissions;
    req.roles = roles;
    req._rbacLoaded = true;
  }
  return req as RbacRequest;
}

// Guard a route by global permission code(s). Passing multiple codes is an OR check.
// `super_admin` always bypasses.
function requirePermission(...codes: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rbac = await loadRbac(req);
      if (rbac.roles.includes('super_admin')) return next();
      const ok = codes.some((c) => rbac.permissions.includes(c));
      if (!ok) {
        throw new ForbiddenError(`Missing required permission: ${codes.join(' or ')}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Guard a route by global role name(s). Passing multiple roles is an OR check.
function requireRole(...roleNames: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rbac = await loadRbac(req);
      const ok = roleNames.some((r) => rbac.roles.includes(r));
      if (!ok) {
        throw new ForbiddenError(`Requires role: ${roleNames.join(' or ')}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export { requirePermission, requireRole, loadRbac };
