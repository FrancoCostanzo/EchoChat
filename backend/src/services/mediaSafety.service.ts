import net from 'net';
import sharp from 'sharp';
import { StatusCodes } from 'http-status-codes';
import config from '../config';
import logger from '../config/logger';
import { AppError } from '../errors';
import { auditRepository } from '../repositories';

/** Estados de `storage_objects.virus_scan_status` que produce el escaneo. */
export type VirusScanStatus = 'clean' | 'infected' | 'error' | 'skipped';

export interface ScanResult {
  status: VirusScanStatus;
  /** Firma detectada por clamd, sólo con `infected`. */
  signature?: string;
}

export interface SanitizedUpload {
  buffer: Buffer;
  sizeBytes: number;
  virusScanStatus: Exclude<VirusScanStatus, 'infected'>;
  /** true si se revisó la imagen y quedó sin EXIF/XMP/IPTC (también si no traía). */
  exifStripped: boolean;
  width?: number;
  height?: number;
}

/** Formatos que sharp re-codifica sin perder la animación ni el tipo MIME. */
const STRIPPABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']);

/** Código que el frontend reconoce para mostrar un mensaje propio. */
export const MALWARE_CODE = 'MALWARE_DETECTED';

class MediaSafetyService {
  /**
   * Escanea y limpia un archivo antes de guardarlo. Lanza 422 si clamd lo marca
   * como infectado (el archivo no se guarda) y 503 si el antivirus es obligatorio
   * y no respondió.
   */
  async sanitize(
    buffer: Buffer,
    mimeType: string,
    ctx: { userId: string; filename: string },
  ): Promise<SanitizedUpload> {
    // Se escanea el original: lo que se re-codifica después ya no puede traer
    // nada que clamd no haya visto.
    const scan = await this.scan(buffer);
    if (scan.status === 'infected') {
      auditRepository.log({
        actor_id: ctx.userId,
        action: 'media.malware_blocked',
        resource_type: 'storage_object',
        severity: 'warning',
        category: 'security',
        metadata: { filename: ctx.filename, mime_type: mimeType, signature: scan.signature },
      }).catch((err: unknown) => logger.warn({ err }, 'Failed to audit blocked upload'));
      throw new AppError('File rejected: malware detected', StatusCodes.UNPROCESSABLE_ENTITY, { code: MALWARE_CODE });
    }
    if (scan.status === 'error' && config.antivirus.required) {
      throw new AppError('Antivirus unavailable, try again later', StatusCodes.SERVICE_UNAVAILABLE);
    }

    const image = await this.stripMetadata(buffer, mimeType);
    return {
      buffer: image.buffer,
      sizeBytes: image.buffer.length,
      virusScanStatus: scan.status,
      exifStripped: image.stripped,
      width: image.width,
      height: image.height,
    };
  }

  /**
   * Quita EXIF (GPS, cámara, fecha), XMP, IPTC y comentarios de una imagen.
   * Aplica antes la orientación EXIF, que si no se perdería con el resto.
   * Si la imagen no trae metadatos no se re-codifica, para no perder calidad.
   */
  async stripMetadata(buffer: Buffer, mimeType: string) {
    if (!STRIPPABLE.has(mimeType)) return { buffer, stripped: false };
    try {
      const meta = await sharp(buffer, { animated: true }).metadata();
      const hasMetadata = !!(meta.exif || meta.xmp || meta.iptc || meta.comments?.length
        || (meta.orientation && meta.orientation !== 1));
      if (!hasMetadata) return { buffer, stripped: true, width: meta.width, height: meta.pageHeight ?? meta.height };

      const animated = (meta.pages ?? 1) > 1;
      // rotate() no admite imágenes animadas; las animadas casi nunca traen orientación.
      let img = sharp(buffer, { animated });
      if (!animated) img = img.rotate();
      // Por defecto sharp no copia metadatos a la salida; sí conserva el perfil
      // de color para que los colores no cambien.
      img = img.keepIccProfile();
      switch (meta.format) {
        case 'jpeg': img = img.jpeg({ quality: 92 }); break;
        case 'webp': img = img.webp({ quality: 92 }); break;
        case 'avif': img = img.avif({ quality: 80 }); break;
        default: break; // png y tiff: sin pérdida con las opciones por defecto
      }
      const { data, info } = await img.toBuffer({ resolveWithObject: true });
      return { buffer: data, stripped: true, width: info.width, height: info.pageHeight ?? info.height };
    } catch (err) {
      // Un archivo que sharp no entiende no es una imagen válida, pero rechazarlo
      // rompería subidas que antes funcionaban: se guarda tal cual, sin marcarlo limpio.
      logger.warn({ err, mimeType }, 'Could not strip image metadata');
      return { buffer, stripped: false };
    }
  }

  /** Manda el archivo a clamd con INSTREAM. Sin `CLAMAV_HOST` devuelve `skipped`. */
  scan(buffer: Buffer): Promise<ScanResult> {
    const { host, port, timeoutMs, maxBytes } = config.antivirus;
    if (!host) return Promise.resolve({ status: 'skipped' });
    if (buffer.length > maxBytes) {
      logger.warn({ sizeBytes: buffer.length, maxBytes }, 'File larger than CLAMAV_MAX_MB, not scanned');
      return Promise.resolve({ status: 'skipped' });
    }

    return new Promise((resolve) => {
      let reply = '';
      let done = false;
      const finish = (result: ScanResult, err?: unknown) => {
        if (done) return;
        done = true;
        socket.destroy();
        if (result.status === 'error') logger.error({ err, reply: reply.trim() }, 'Antivirus scan failed');
        resolve(result);
      };

      const socket = net.createConnection({ host, port });
      socket.setTimeout(timeoutMs, () => finish({ status: 'error' }, new Error('clamd timeout')));
      socket.on('error', (err) => finish({ status: 'error' }, err));
      socket.on('data', (chunk) => { reply += chunk.toString('utf8'); });
      socket.on('end', () => finish(parseReply(reply)));
      socket.on('close', () => finish(parseReply(reply)));

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        // clamd acepta el stream en trozos con el largo en 4 bytes big-endian.
        const CHUNK = 64 * 1024;
        for (let i = 0; i < buffer.length; i += CHUNK) {
          const part = buffer.subarray(i, i + CHUNK);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(part.length);
          socket.write(len);
          socket.write(part);
        }
        socket.write(Buffer.alloc(4)); // largo 0 = fin del stream
      });
    });
  }
}

/** "stream: OK", "stream: Eicar-Signature FOUND" o "... ERROR" (terminado en \0). */
function parseReply(raw: string): ScanResult {
  const reply = raw.replace(/\0/g, '').trim();
  if (/:\s*OK$/.test(reply)) return { status: 'clean' };
  const found = /:\s*(.+)\s+FOUND$/.exec(reply);
  if (found) return { status: 'infected', signature: found[1] };
  return { status: 'error' };
}

export default new MediaSafetyService();
