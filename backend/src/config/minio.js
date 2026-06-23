const Minio = require('minio');
const config = require('../config');
const logger = require('./logger');

// Cliente interno: para operaciones de upload/delete (conecta al host interno)
const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

// Cliente público: para generar presigned URLs accesibles desde el navegador
const publicMinioClient = new Minio.Client({
  endPoint: config.minio.publicEndPoint,
  port: config.minio.publicPort,
  useSSL: config.minio.publicUseSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKETS = [
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

async function ensureBuckets() {
  for (const bucket of BUCKETS) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      logger.info(`Created MinIO bucket: ${bucket}`);
    }
  }
  logger.info('All MinIO buckets verified');
}

module.exports = { minioClient, publicMinioClient, ensureBuckets, BUCKETS };
