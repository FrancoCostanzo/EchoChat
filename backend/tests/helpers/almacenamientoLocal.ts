import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Fuerza el driver de almacenamiento `local` en una carpeta temporal. Tiene que
 * ser el PRIMER import del archivo de test: `src/config` lee el entorno al
 * cargarse, y este módulo no importa nada de la app.
 */
export const DIR_ALMACENAMIENTO = mkdtempSync(path.join(tmpdir(), 'echochat-storage-'));

process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = DIR_ALMACENAMIENTO;
process.env.STORAGE_PUBLIC_URL = '';
