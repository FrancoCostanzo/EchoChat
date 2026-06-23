const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

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
    attr: {
      username: process.env.LDAP_ATTR_USERNAME || 'sAMAccountName',
      displayName: process.env.LDAP_ATTR_DISPLAY_NAME || 'displayName',
      email: process.env.LDAP_ATTR_EMAIL || 'mail',
      department: process.env.LDAP_ATTR_DEPARTMENT || 'department',
      jobTitle: process.env.LDAP_ATTR_JOB_TITLE || 'title',
      // Atributo del id estable. objectGUID (AD) viene binario → se serializa a hex.
      externalId: process.env.LDAP_ATTR_EXTERNAL_ID || 'objectGUID',
    },
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
