import { createHash } from 'crypto';
import config from '../index';
import { S3StorageProvider } from './s3.provider';
import { LocalStorageProvider } from './local.provider';
import type { StorageProvider } from './types';

export type { StorageProvider, StorageDriver } from './types';
export { LocalStorageProvider } from './local.provider';

/** Buckets lógicos: son los nombres que quedan guardados en la base. */
export const BUCKETS = [
  'messaging-avatars',
  'messaging-images',
  'messaging-videos',
  'messaging-audio',
  'messaging-documents',
  'messaging-thumbnails',
  'messaging-recordings',
  'messaging-stickers',
  'messaging-wallpapers',
] as const;

function createProvider(): StorageProvider {
  const { driver, bucketPrefix, s3, local } = config.storage;
  if (driver === 'local') {
    // Sin clave propia se deriva una de JWT_SECRET (separada por dominio), así
    // las URLs firmadas sobreviven a un reinicio sin otra variable obligatoria.
    const secret = local.secret
      || (config.jwt.secret ? createHash('sha256').update(`storage-local:${config.jwt.secret}`).digest('hex') : '');
    return new LocalStorageProvider({ dir: local.dir, publicUrl: local.publicUrl, secret });
  }
  return new S3StorageProvider({ ...s3, bucketPrefix });
}

/** Almacenamiento activo según `STORAGE_DRIVER` (por defecto, S3 compatible). */
export const storage: StorageProvider = createProvider();

export function ensureBuckets(): Promise<void> {
  return storage.ensureBuckets(BUCKETS);
}
