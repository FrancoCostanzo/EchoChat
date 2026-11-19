import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { storageService } from '../services';
import { BadRequestError } from '../errors';

/**
 * Grupos de la regex de la ruta: 0 = bucket, 1 = key (puede tener barras).
 * Express ya los entrega decodificados.
 */
function objectPath(req: Request): { bucket: string; key: string } {
  const params = req.params as Record<string, string>;
  return { bucket: String(params[0] ?? ''), key: String(params[1] ?? '') };
}

/**
 * Archivos del driver de almacenamiento `local`. No usa JWT: la URL firmada
 * (vencimiento + HMAC) es la autorización, igual que una prefirmada de S3.
 */
class StorageFileController {
  async download(req: Request, res: Response) {
    const { bucket, key } = objectPath(req);
    const file = await storageService.getLocalFile(bucket, key, { exp: req.query.exp, sig: req.query.sig });
    const maxAge = Math.max(0, file.expiresAt - Math.floor(Date.now() / 1000));
    res.sendFile(file.filePath, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `${file.inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.fileName)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': `private, max-age=${maxAge}`,
      },
    });
  }

  async upload(req: Request, res: Response) {
    const { bucket, key } = objectPath(req);
    // El parser JSON global ya consumió los cuerpos application/json: mejor
    // rechazarlos que guardar un archivo vacío.
    if (!Buffer.isBuffer(req.body)) throw new BadRequestError('Unsupported upload content type');
    const body = req.body;
    await storageService.putLocalFile(bucket, key, { exp: req.query.exp, sig: req.query.sig }, body, req.get('content-type'));
    res.status(StatusCodes.OK).end();
  }
}

export default new StorageFileController();
