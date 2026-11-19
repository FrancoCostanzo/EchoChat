/**
 * Contrato del almacenamiento de archivos. El resto del backend sólo habla con
 * esta interfaz; el adaptador concreto (S3 compatible o disco local) lo elige
 * `STORAGE_DRIVER` al arrancar.
 *
 * Los `bucket` que reciben los métodos son los nombres **lógicos** que guarda la
 * base (`messaging-images`, …). Cada adaptador los traduce al nombre físico
 * (por ejemplo, agregando `STORAGE_BUCKET_PREFIX`).
 */
export interface StorageProvider {
  readonly driver: StorageDriver;

  /** Crea los buckets que falten. Se llama una vez al arrancar. */
  ensureBuckets(buckets: readonly string[]): Promise<void>;

  putObject(bucket: string, key: string, body: Buffer, size: number, contentType?: string): Promise<void>;

  /** Borra el objeto. No falla si ya no existe. */
  removeObject(bucket: string, key: string): Promise<void>;

  /** URL de descarga firmada, resoluble desde el navegador del usuario. */
  getSignedUrl(bucket: string, key: string, ttlSeconds: number): Promise<string>;

  /** URL firmada para que el cliente suba el archivo directo con un PUT. */
  getSignedUploadUrl(bucket: string, key: string, ttlSeconds: number): Promise<string>;
}

export type StorageDriver = 's3' | 'local';
