const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Parsea "CN=Admins,OU=x=admin; CN=Staff,OU=y=user" → { 'cn=admins,ou=x': 'admin', ... }.
// La clave (DN del grupo) se normaliza a minúsculas para comparar sin depender del casing del directorio.
function parseGroupRoleMap(raw) {
  if (!raw) return {};
  const map = {};
  for (const pair of String(raw).split(';')) {
    const idx = pair.lastIndexOf('=');
    if (idx <= 0) continue;
    const dn = pair.slice(0, idx).trim().toLowerCase();
    const role = pair.slice(idx + 1).trim();
    if (dn && role) map[dn] = role;
  }
  return map;
}

// Construye el registro de proveedores OIDC a partir de OIDC_PROVIDERS=azure,google,...
// Para cada nombre P lee OIDC_<P>_ISSUER / _CLIENT_ID / _CLIENT_SECRET / _SCOPES / _LABEL.
// Sólo se registran los que tengan issuer + client_id + client_secret completos.
function parseOidcProviders(rawList) {
  const providers = {};
  if (!rawList) return providers;
  for (const name of String(rawList).split(',').map((s) => s.trim()).filter(Boolean)) {
    const key = name.toLowerCase();
    const env = (suffix) => process.env[`OIDC_${name.toUpperCase()}_${suffix}`];
    const issuer = env('ISSUER');
    const clientId = env('CLIENT_ID');
    const clientSecret = env('CLIENT_SECRET');
    if (!issuer || !clientId || !clientSecret) continue;
    providers[key] = {
      name: key,
      label: env('LABEL') || name,
      issuer,
      clientId,
      clientSecret,
      scopes: (env('SCOPES') || 'openid profile email').trim(),
    };
  }
  return providers;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'echochat',
    user: process.env.DB_USER || 'echochat',
    password: process.env.DB_PASSWORD || '',
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
    publicPort: parseInt(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT, 10) || 9000,
    publicUseSSL: (process.env.MINIO_PUBLIC_USE_SSL || process.env.MINIO_USE_SSL) === 'true',
  },

  ldap: {
    enabled: process.env.LDAP_ENABLED === 'true',
    url: process.env.LDAP_URL || '',                       // ej: ldap://dc.empresa.local:389
    bindDn: process.env.LDAP_BIND_DN || '',                // cuenta de servicio
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    baseDn: process.env.LDAP_BASE_DN || '',                // base de búsqueda de usuarios
    // {{username}} se reemplaza por el usuario en authenticate(); en fetchAllUsers se usa tal cual.
    userFilter: process.env.LDAP_USER_FILTER || '(objectClass=person)',
    timeoutMs: parseInt(process.env.LDAP_TIMEOUT_MS, 10) || 10000,
    tlsRejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',

    // Sincronización automática (job cron). Independiente de la importación manual.
    syncEnabled: process.env.LDAP_SYNC_ENABLED === 'true',
    syncCron: process.env.LDAP_SYNC_CRON || '0 */6 * * *', // cada 6 horas por defecto
    // Al sincronizar, deshabilitar en EchoChat a los usuarios LDAP que ya no aparecen
    // en el directorio (o que AD marca como cuenta deshabilitada). Off por defecto.
    deprovision: process.env.LDAP_DEPROVISION === 'true',
    // Sincronizar roles desde grupos del directorio. Requiere groupRoleMap configurado.
    syncRoles: process.env.LDAP_SYNC_ROLES === 'true',
    groupRoleMap: parseGroupRoleMap(process.env.LDAP_GROUP_ROLE_MAP),
    defaultRole: process.env.LDAP_DEFAULT_ROLE || 'user',

    attr: {
      username: process.env.LDAP_ATTR_USERNAME || 'sAMAccountName',
      displayName: process.env.LDAP_ATTR_DISPLAY_NAME || 'displayName',
      email: process.env.LDAP_ATTR_EMAIL || 'mail',
      department: process.env.LDAP_ATTR_DEPARTMENT || 'department',
      jobTitle: process.env.LDAP_ATTR_JOB_TITLE || 'title',
      // Grupos del usuario (para mapear a roles) y flag de cuenta deshabilitada (AD).
      memberOf: process.env.LDAP_ATTR_MEMBER_OF || 'memberOf',
      accountControl: process.env.LDAP_ATTR_ACCOUNT_CONTROL || 'userAccountControl',
      // Atributo del id estable. objectGUID (AD) viene binario → se serializa a hex.
      externalId: process.env.LDAP_ATTR_EXTERNAL_ID || 'objectGUID',
    },
  },

  // SSO por OpenID Connect (Azure AD, Google Workspace, Okta, etc.).
  oidc: {
    enabled: process.env.OIDC_ENABLED === 'true',
    // Base pública del backend para armar el redirect_uri que se registra en el IdP.
    // Debe ser accesible desde el navegador del usuario. Si falta, se deriva del request.
    redirectBase: process.env.OIDC_REDIRECT_BASE || '',
    // A dónde vuelve el navegador tras el login (página que lee el token del fragmento).
    // Por defecto el mismo origen del frontend (CORS_ORIGIN) + /auth/callback.
    frontendUrl: process.env.OIDC_FRONTEND_URL || '',
    // Rol asignado a los usuarios creados por JIT provisioning.
    defaultRole: process.env.OIDC_DEFAULT_ROLE || 'user',
    providers: parseOidcProviders(process.env.OIDC_PROVIDERS),
  },

  // Cifrado de contenido de mensajes en reposo (AES-256-GCM). La clave maestra
  // (32 bytes en base64) deriva la clave de cifrado y la de búsqueda (índice ciego).
  messageEnc: {
    key: process.env.MESSAGE_ENC_KEY,
    keyId: process.env.MESSAGE_ENC_KEY_ID || 'v1',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
