import express, { Router } from 'express';
import { storageFileController } from '../controllers';

// Sólo responde con STORAGE_DRIVER=local (con S3 devuelve 404): sirve y recibe
// los archivos de las URLs firmadas que genera LocalStorageProvider.
//
// `/<bucket>/<key con barras>`. Va como regex (grupos 0 y 1) porque la sintaxis
// de comodines cambia entre Express 4 (`*`) y 5 (`*nombre`); la regex anda en ambas.
const OBJECT_PATH = /^\/([^/]+)\/(.+)$/;

const router = Router();

router.get(OBJECT_PATH, (req, res) => storageFileController.download(req, res));
router.put(
  OBJECT_PATH,
  express.raw({ type: () => true, limit: '500mb' }),
  (req, res) => storageFileController.upload(req, res),
);

export default router;
