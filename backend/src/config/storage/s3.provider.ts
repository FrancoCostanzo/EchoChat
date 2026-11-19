import * as Minio from 'minio';
import logger from '../logger';
import type { StorageProvider } from './types';

export interface S3ProviderOptions {
  endPoint: string;
  port?: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  /** Obligatoria en AWS; con MinIO puede quedar vacía. */
  region?: string;
  /** `true` = http://host/bucket/key (MinIO, Garage); `false` = http://bucket.host/key (AWS). */
  pathStyle: boolean;
  /** Host con el que el navegador resuelve las URLs firmadas (puede diferir del interno). */
  publicEndPoint: string;
  publicPort?: number;
  publicUseSSL: boolean;
  /** Se antepone a cada bucket lógico: los nombres de bucket de AWS son globales. */
  bucketPrefix: string;
}

/**
 * Adaptador para cualquier servicio compatible con S3: MinIO, AWS S3,
 * Cloudflare R2, Wasabi, Backblaze B2, Garage, SeaweedFS…
 *
 * Usa dos clientes: el interno sube y borra contra el host de la red del
 * backend, y el público firma las URLs con el host que ve el navegador. La
 * firma S3 incluye el host, así que no se puede firmar con uno y servir con otro.
 */
export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;
  private readonly client: Minio.Client;
  private readonly publicClient: Minio.Client;

  constructor(private readonly opts: S3ProviderOptions) {
    const common = {
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
      pathStyle: opts.pathStyle,
      ...(opts.region ? { region: opts.region } : {}),
    };
    this.client = new Minio.Client({
      ...common,
      endPoint: opts.endPoint,
      port: opts.port,
      useSSL: opts.useSSL,
    });
    this.publicClient = new Minio.Client({
      ...common,
      endPoint: opts.publicEndPoint,
      port: opts.publicPort,
      useSSL: opts.publicUseSSL,
    });
  }

  private physical(bucket: string): string {
    return `${this.opts.bucketPrefix}${bucket}`;
  }

  async ensureBuckets(buckets: readonly string[]): Promise<void> {
    for (const bucket of buckets) {
      const name = this.physical(bucket);
      const exists = await this.client.bucketExists(name);
      if (!exists) {
        await this.client.makeBucket(name, this.opts.region || undefined);
        logger.info(`Created storage bucket: ${name}`);
      }
    }
    logger.info({ driver: this.driver }, 'All storage buckets verified');
  }

  async putObject(bucket: string, key: string, body: Buffer, size: number, contentType?: string): Promise<void> {
    await this.client.putObject(this.physical(bucket), key, body, size, contentType ? { 'Content-Type': contentType } : {});
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(this.physical(bucket), key);
  }

  getSignedUrl(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    return this.publicClient.presignedGetObject(this.physical(bucket), key, ttlSeconds);
  }

  getSignedUploadUrl(bucket: string, key: string, ttlSeconds: number): Promise<string> {
    return this.publicClient.presignedPutObject(this.physical(bucket), key, ttlSeconds);
  }
}
