const jwt = require('jsonwebtoken');
const config = require('../config');

// Guarda el material efímero de una transacción OIDC (state/nonce/PKCE) entre el
// redirect al IdP y el callback. Va en una cookie httpOnly firmada de corta vida:
// no requiere estado en el servidor y sobrevive reinicios / múltiples instancias.
const COOKIE_NAME = 'echo_sso';
const COOKIE_PATH = '/api/auth/sso';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

function _cookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax', // se envía en la navegación top-level de vuelta del IdP
    path: COOKIE_PATH,
    maxAge: MAX_AGE_MS,
  };
}

function setTransaction(res, transaction) {
  const token = jwt.sign(transaction, config.jwt.secret, { expiresIn: '10m' });
  res.cookie(COOKIE_NAME, token, _cookieOptions());
}

// Lee la cookie (parseando el header, sin cookie-parser), la verifica y la borra.
// Devuelve la transacción o null si falta/está expirada/es inválida.
function readAndClearTransaction(req, res) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
  if (!match) return null;
  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  try {
    return jwt.verify(value, config.jwt.secret);
  } catch {
    return null;
  }
}

module.exports = { setTransaction, readAndClearTransaction };
