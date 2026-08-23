import { minioClient } from '../config/minio';
import logger from '../config/logger';

// ──────────────────────────────────────────────────────────────────────────────
// URLs prefirmadas de avatares de usuario.
//
// Los avatares de usuario no pasan por `storage_objects` (viven como
// bucket + object_key en la fila de `users`), así que tampoco pasan por la caché
// de prefirmadas de `storageService`. Sin una caché acá, pintar una página de 50
// mensajes serían 50 round-trips a MinIO — y el mismo remitente se repite.
//
// La firma dura 24 h y la entrada se guarda 12 h: siempre se entrega una URL con
// al menos medio día de vida por delante.
// ──────────────────────────────────────────────────────────────────────────────

const BUCKET_POR_DEFECTO = 'messaging-avatars';
const TTL_FIRMA_SEGUNDOS = 60 * 60 * 24;
const TTL_CACHE_MS = 60 * 60 * 12 * 1000;

const cache = new Map<string, { url: string; expira: number }>();

/** URL del avatar, o null si no hay foto o MinIO no responde. */
export async function urlDeAvatar(
  objectKey: string | null | undefined,
  bucket?: string | null,
): Promise<string | null> {
  if (!objectKey) return null;
  const balde = bucket || BUCKET_POR_DEFECTO;
  const clave = `${balde}/${objectKey}`;

  const enCache = cache.get(clave);
  if (enCache && enCache.expira > Date.now()) return enCache.url;

  try {
    const url = await minioClient.presignedGetObject(balde, objectKey, TTL_FIRMA_SEGUNDOS);
    cache.set(clave, { url, expira: Date.now() + TTL_CACHE_MS });
    return url;
  } catch (err) {
    // MinIO caído no puede tumbar el render de los mensajes: sin foto, iniciales.
    logger.warn({ err: (err as Error).message, objectKey }, 'No se pudo firmar la URL del avatar');
    return null;
  }
}

/**
 * Resuelve varias claves de una sola pasada, deduplicando: en una conversación
 * los mismos dos o tres remitentes se repiten en toda la página.
 */
export async function urlesDeAvatares(
  claves: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicas = [...new Set(claves.filter((k): k is string => !!k))];
  const resultado = new Map<string, string>();
  await Promise.all(unicas.map(async (clave) => {
    const url = await urlDeAvatar(clave);
    if (url) resultado.set(clave, url);
  }));
  return resultado;
}
