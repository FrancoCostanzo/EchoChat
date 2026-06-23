const { userRepository } = require('../repositories');
const { ForbiddenError, UnauthorizedError } = require('../errors');

// Lazily load the user's roles + permissions onto the request once per request.
// Must run after `authenticate` (which sets req.user).
async function loadRbac(req) {
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
  return req;
}

// Guard a route by global permission code(s). Passing multiple codes is an OR check.
// `super_admin` always bypasses.
function requirePermission(...codes) {
  return async (req, res, next) => {
    try {
      await loadRbac(req);
      if (req.roles.includes('super_admin')) return next();
      const ok = codes.some((c) => req.permissions.includes(c));
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
function requireRole(...roleNames) {
  return async (req, res, next) => {
    try {
      await loadRbac(req);
      const ok = roleNames.some((r) => req.roles.includes(r));
      if (!ok) {
        throw new ForbiddenError(`Requires role: ${roleNames.join(' or ')}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireRole, loadRbac };
