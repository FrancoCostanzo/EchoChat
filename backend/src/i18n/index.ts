import es from './es.json';
import en from './en.json';
import pt from './pt.json';

/**
 * Textos que arma el servidor para canales fuera de la app (push, email). La
 * UI tiene sus propias traducciones en frontend/src/locales; acá sólo va lo
 * que se manda a un usuario que no tiene la app abierta.
 */
const DICCIONARIOS = { es, en, pt } as const;

export type Idioma = keyof typeof DICCIONARIOS;
export const IDIOMAS = Object.keys(DICCIONARIOS) as Idioma[];

/** `es-AR` → `es`; lo desconocido cae a español, el idioma por defecto de la app. */
export function idiomaDe(locale: string | null | undefined): Idioma {
  const base = String(locale || '').slice(0, 2).toLowerCase();
  return (IDIOMAS as string[]).includes(base) ? (base as Idioma) : 'es';
}

function buscar(dic: unknown, clave: string): string | undefined {
  let nodo: unknown = dic;
  for (const parte of clave.split('.')) {
    if (!nodo || typeof nodo !== 'object') return undefined;
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  return typeof nodo === 'string' ? nodo : undefined;
}

/** Traduce `clave` (con puntos) e interpola `{{param}}`. Si falta, usa español y si no, la clave. */
export function t(idioma: Idioma, clave: string, params: Record<string, string | number> = {}): string {
  const texto = buscar(DICCIONARIOS[idioma], clave) ?? buscar(DICCIONARIOS.es, clave) ?? clave;
  return texto.replace(/\{\{(\w+)\}\}/g, (_, p: string) => String(params[p] ?? ''));
}
