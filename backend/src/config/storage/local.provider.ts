import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../logger';
import type { StorageProvider } from './types';

export interface LocalProviderOptions {
  /** Carpeta raíz: cada bucket es una subcarpeta. */
  dir: string;
  /**
   * Origen con el que el navegador llega al backend (`https://chat.empresa.com`).
   * Vacío = URLs relativas (`/api/storage/files/…`), que sirven si la web y la
   * API comparten origen o hay proxy (Vite en desarrollo).
   */
  publicUrl: string;
  /** Clave HMAC con la que se firman las URLs. */
  secret: string;
}

export type SignedOp = 'get' | 'put';

/** Lo que guardamos junto a cada archivo (`<archivo>.meta.json`). */
interface ObjectMeta {
  contentType?: string;
}

export const LOCAL_FILES_PATH = '/api/storage/files';
const META_SUFFIX = '.meta.json';
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
// Las claves llevan la extensión que eligió el usuario: se aceptan más
// caracteres, pero nunca separadores, controles ni los reservados de Windows.
const SAFE_KEY_SEGMENT = /^[^/\\\x00-\x1f:*?"<>|]+$/;

/**
 * Guarda los archivos en el disco del servidor. Pensado para desarrollo sin
 * Docker o instalaciones chicas de un solo servidor: no escala a varias
 * instancias del backend salvo que compartan la carpeta (NFS, volumen).
 *
 * Las URLs "firmadas" imitan a S3: apuntan a una ruta del propio backend con
 * vencimiento y firma HMAC, así el resto de la app no nota la diferencia.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(private readonly opts: LocalProviderOptions) {
    if (!opts.secret) throw new Error('LocalStorageProvider: falta la clave para firmar URLs');
    this.root = path.resolve(opts.dir);
  }

  /**
   * Ruta absoluta del objeto. Rechaza cualquier bucket/key que pueda salirse de
   * la carpeta raíz (`..`, rutas absolutas, separadores raros).
   */
  resolvePath(bucket: string, key: string): string {
    if (!SAFE_SEGMENT.test(bucket)) throw new Error(`Bucket inválido: ${bucket}`);
    const segments = key.split('/');
    if (segments.length === 0 || segments.some((s) => !SAFE_KEY_SEGMENT.test(s) || s === '.' || s === '..' || s.endsWith(META_SUFFIX))) {
      throw new Error(`Clave inválida: ${key}`);
    }
    const full = path.resolve(this.root, bucket, ...segments);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Clave inválida: ${key}`);
    return full;
  }

  async ensureBuckets(buckets: readonly string[]): Promise<void> {
    for (const bucket of buckets) {
      if (!SAFE_SEGMENT.test(bucket)) throw new Error(`Bucket inválido: ${bucket}`);
      await fs.mkdir(path.join(this.root, bucket), { recursive: true });
    }
    logger.info({ driver: this.driver, dir: this.root }, 'All storage buckets verified');
  }

  async putObject(bucket: string, key: string, body: Buffer, _size: number, contentType?: string): Promise<void> {
    const file = this.resolvePath(bucket, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    const meta: ObjectMeta = { contentType };
    await fs.writeFile(file + META_SUFFIX, JSON.stringify(meta));
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    const file = this.resolvePath(bucket, key);
    await fs.rm(file, { force: true });
    await fs.rm(file + META_SUFFIX, { force: true });
  }

  async readMeta(bucket: string, key: string): Promise<ObjectMeta> {
    try {
      const raw = await fs.readFile(this.resolvePath(bucket, key) + META_SUFFIX, 'utf8');
      return JSON.parse(raw) as ObjectMeta;
    } catch {
      return {};
    }
  }

  getSignedUrl(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    return Promise.resolve(this.buildUrl('get', bucket, key, ttlSeconds));
  }

  getSignedUploadUrl(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    return Promise.resolve(this.buildUrl('put', bucket, key, ttlSeconds));
  }

  private sign(op: SignedOp, bucket: string, key: string, exp: number): string {
    return createHmac('sha256', this.opts.secret)
      .update(`${op}\n${bucket}\n${key}\n${exp}`)
      .digest('base64url');
  }

  private buildUrl(op: SignedOp, bucket: string, key: string, ttlSeconds: number): string {
    this.resolvePath(bucket, key); // valida antes de firmar
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(op, bucket, key, exp);
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const qs = new URLSearchParams({ exp: String(exp), sig, ...(op === 'put' ? { op } : {}) });
    return `${this.opts.publicUrl}${LOCAL_FILES_PATH}/${bucket}/${encodedKey}?${qs.toString()}`;
  }

  /** `true` si la firma corresponde a esa operación y todavía no venció. */
  verify(op: SignedOp, bucket: string, key: string, exp: unknown, sig: unknown): boolean {
    const expNum = Number(exp);
    if (!Number.isInteger(expNum) || typeof sig !== 'string') return false;
    if (expNum < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(op, bucket, key, expNum));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
