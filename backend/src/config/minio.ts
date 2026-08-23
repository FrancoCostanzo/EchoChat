import * as Minio from 'minio';
import config from '../config';
import logger from './logger';

// Cliente interno: para operaciones de upload/delete (conecta al host interno)
export const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

// Cliente público: para generar presigned URLs accesibles desde el navegador
export const publicMinioClient = new Minio.Client({
  endPoint: config.minio.publicEndPoint,
  port: config.minio.publicPort,
  useSSL: config.minio.publicUseSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

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
];

export async function ensureBuckets(): Promise<void> {
  for (const bucket of BUCKETS) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      logger.info(`Created MinIO bucket: ${bucket}`);
    }
  }
  logger.info('All MinIO buckets verified');
}
