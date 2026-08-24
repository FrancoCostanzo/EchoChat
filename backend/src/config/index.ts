import os from 'os';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface OidcProvider {
  name: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
}

/**
 * Forma completa de la configuración del backend. Todo sale de `process.env`,
 * o sea que todo llega como `string | undefined` y acá se convierte: los
 * `parseInt` y las comparaciones contra `'true'` son la frontera entre el
 * entorno y el resto del código.
 *
 * Los campos sin valor por defecto (`jwt.secret`, `messageEnc.key`) quedan
 * `string | undefined` a propósito: son obligatorios en producción y el tipo
 * refleja que pueden faltar.
 */
interface AppConfig {
  env: string;
  port: number;
  /** Identifica a esta instancia en los logs y en el estado de los cron jobs. */
  instanceId: string;
  jobs: { enabled: boolean };
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    min: number;
    max: number;
  };
  redis: { url: string };
  jwt: {
    secret: string | undefined;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  minio: {
    endPoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
    publicEndPoint: string;
    publicPort: number;
    publicUseSSL: boolean;
  };
  ldap: {
    enabled: boolean;
    url: string;
    bindDn: string;
    bindPassword: string;
    baseDn: string;
    userFilter: string;
    timeoutMs: number;
    tlsRejectUnauthorized: boolean;
    syncEnabled: boolean;
    syncCron: string;
    deprovision: boolean;
    syncRoles: boolean;
    groupRoleMap: Record<string, string>;
    defaultRole: string;
    attr: {
      username: string;
      displayName: string;
      email: string;
      department: string;
      jobTitle: string;
      memberOf: string;
      accountControl: string;
      externalId: string;
    };
  };
  oidc: {
    enabled: boolean;
    redirectBase: string;
    frontendUrl: string;
    defaultRole: string;
    providers: Record<string, OidcProvider>;
  };
  scim: { enabled: boolean; token: string; defaultRole: string };
  messageEnc: { key: string | undefined; keyId: string };
  cors: { origins: string[] };
  rateLimit: { windowMs: number; max: number };
  log: { level: string };
}

/** Convierte una variable de entorno numérica, cayendo al default si no es válida. */
function num(raw: string | undefined, fallback: number): number {
  return parseInt(raw ?? '', 10) || fallback;
}

/**
 * Origin del cliente de escritorio (Electron). El renderer se sirve por un
 * esquema propio `app://` en vez de http, así que su `Origin` es fijo y no
 * depende de dónde esté instalado — ver desktop/src/main/protocol.ts.
 *
 * Va siempre en la allowlist en vez de pedirle a cada admin que lo agregue a
 * mano: el instalador es el mismo para todas las organizaciones. No debilita
 * nada, porque quien autoriza de verdad es el JWT, no el origin.
 */
export const DESKTOP_ORIGIN = 'app://echochat';

/**
 * `CORS_ORIGIN` acepta varios origins separados por comas — hacen falta al
 * menos dos en cuanto convive la web con la app de escritorio, y suele haber
 * más (dominio viejo y nuevo durante una migración, staging, etc.).
 */
function parseCorsOrigins(raw: string | undefined): string[] {
  const configured = String(raw || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set([...configured, DESKTOP_ORIGIN])];
}

// Parsea "CN=Admins,OU=x=admin; CN=Staff,OU=y=user" → { 'cn=admins,ou=x': 'admin', ... }.
// La clave (DN del grupo) se normaliza a minúsculas para comparar sin depender del casing del directorio.
function parseGroupRoleMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const map: Record<string, string> = {};
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
function parseOidcProviders(rawList: string | undefined): Record<string, OidcProvider> {
  const providers: Record<string, OidcProvider> = {};
  if (!rawList) return providers;
  for (const name of String(rawList).split(',').map((s) => s.trim()).filter(Boolean)) {
    const key = name.toLowerCase();
    const env = (suffix: string) => process.env[`OIDC_${name.toUpperCase()}_${suffix}`];
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

const config: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),

  instanceId: `${os.hostname()}:${process.pid}`,

  jobs: {
    // Poner RUN_JOBS=false en instancias que sólo deban atender tráfico. Con
    // varias instancias, además, sólo una ejecuta cada corrida (lock en Redis).
    enabled: process.env.RUN_JOBS !== 'false',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: num(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'echochat',
    user: process.env.DB_USER || 'echochat',
    password: process.env.DB_PASSWORD || '',
    min: num(process.env.DB_POOL_MIN, 2),
    max: num(process.env.DB_POOL_MAX, 20),
  },

  // Estado compartido entre instancias (adapter de Socket.IO, presencia, rate
  // limit). Sin REDIS_URL el backend funciona, pero sólo en una instancia.
  redis: {
    url: process.env.REDIS_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: num(process.env.MINIO_PORT, 9000),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
    publicPort: num(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT, 9000),
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
    timeoutMs: num(process.env.LDAP_TIMEOUT_MS, 10000),
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

  // SCIM 2.0 — aprovisionamiento/desaprovisionamiento que empujan Okta/Azure.
  scim: {
    enabled: process.env.SCIM_ENABLED === 'true',
    // Bearer token estático que el IdP presenta en cada request. Largo y secreto.
    token: process.env.SCIM_TOKEN || '',
    // Rol asignado a los usuarios aprovisionados por SCIM.
    defaultRole: process.env.SCIM_DEFAULT_ROLE || 'user',
  },

  // Cifrado de contenido de mensajes en reposo (AES-256-GCM). La clave maestra
  // (32 bytes en base64) deriva la clave de cifrado y la de búsqueda (índice ciego).
  messageEnc: {
    key: process.env.MESSAGE_ENC_KEY,
    keyId: process.env.MESSAGE_ENC_KEY_ID || 'v1',
  },

  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGIN),
  },

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.RATE_LIMIT_MAX, 100),
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
