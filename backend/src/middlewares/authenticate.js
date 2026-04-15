const { authService } = require('../services');
const { UnauthorizedError } = require('../errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = header.split(' ')[1];
  if (!token) throw new UnauthorizedError('Token not provided');

  authService
    .validateToken(token)
    .then(({ user, session }) => {
      req.user = user;
      req.session = session;
      next();
    })
    .catch(next);
}

module.exports = authenticate;
