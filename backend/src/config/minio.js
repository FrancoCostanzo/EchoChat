const Minio = require('minio');
const config = require('../config');
const logger = require('./logger');

const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
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

module.exports = { minioClient, ensureBuckets, BUCKETS };
