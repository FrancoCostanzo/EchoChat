import crypto from 'crypto';
import config from '../config';

// ──────────────────────────────────────────────────────────────────────────────
// Cifrado de contenido en reposo (AES-256-GCM) + índice ciego de búsqueda (HMAC).
//
// Objetivo: que el contenido de los mensajes NO se guarde en texto plano en la
// base de datos. El servidor mantiene la clave maestra (config.messageEnc.key) y
// descifra al servir, de modo que búsqueda server-side, previews y panel admin
// siguen funcionando. Protege contra robo de un dump/backup de la BD, acceso al
// disco o lectura directa de filas (p. ej. SQL injection).
//
// Formato del token cifrado (string en la misma columna TEXT):
//   enc:<keyId>:<iv_b64url>:<tag_b64url>:<ciphertext_b64url>
//
// El prefijo permite rotación de clave y migración gradual: decrypt() devuelve el
// valor tal cual si no empieza por "enc:" (texto plano heredado).
// ──────────────────────────────────────────────────────────────────────────────

const PREFIX = 'enc';

function loadMasterKey(): Buffer {
  const raw = config.messageEnc.key;
  if (!raw) {
    throw new Error(
      'MESSAGE_ENC_KEY no está configurada. Genere una con: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`MESSAGE_ENC_KEY debe ser 32 bytes en base64 (recibidos ${key.length}).`);
  }
  return key;
}

const MASTER_KEY = loadMasterKey();
export const KEY_ID = config.messageEnc.keyId;

// Derivamos dos subclaves del maestro (separación de dominios):
//  - encKey:    cifrado AES-256-GCM del contenido.
//  - searchKey: HMAC determinista de los tokens del índice ciego.
const ENC_KEY = Buffer.from(crypto.hkdfSync('sha256', MASTER_KEY, Buffer.alloc(0), 'echochat:message-body', 32));
const SEARCH_KEY = Buffer.from(crypto.hkdfSync('sha256', MASTER_KEY, Buffer.alloc(0), 'echochat:message-search', 32));

/** Cifra un string. Devuelve null si la entrada es null/undefined. */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12); // nonce de 96 bits, recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${KEY_ID}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ct.toString('base64url')}`;
}

/** Descifra un token. Passthrough si es null o texto plano heredado (sin prefijo). */
export function decrypt(token: string | null | undefined): string | null {
  if (token == null) return null;
  if (typeof token !== 'string' || !token.startsWith(`${PREFIX}:`)) return token;
  const parts = token.split(':');
  // enc : keyId : iv : tag : ct
  if (parts.length !== 5) return token;
  const [, , ivB64, tagB64, ctB64] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    // Clave equivocada o dato manipulado: no exponemos ciphertext crudo.
    return null;
  }
}

// Normaliza texto a tokens comparables: minúsculas, sin acentos, solo
// alfanumérico, longitud mínima 2. Es el mismo criterio al indexar y al buscar.
function tokenize(text: unknown): string[] {
  if (!text) return [];
  const normalized = String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  const seen = new Set<string>();
  for (const word of normalized.split(' ')) {
    if (word.length >= 2) seen.add(word);
  }
  return [...seen];
}

/** HMAC-SHA256 determinista de un token normalizado (hex). */
function hashToken(word: string): string {
  return crypto.createHmac('sha256', SEARCH_KEY).update(word).digest('hex');
}

/** Tokens HMAC para indexar un texto (índice ciego). Deduplicados. */
export function searchTokens(text: unknown): string[] {
  return tokenize(text).map(hashToken);
}

/** Tokens HMAC de una consulta de búsqueda. Igual que searchTokens. */
export function searchQueryTokens(term: unknown): string[] {
  return tokenize(term).map(hashToken);
}
