import type { MessageMention } from '@/types/message';

/**
 * Utilidades de @menciones del lado cliente.
 *
 * El backend ya resolvió quién fue mencionado y lo dejó en `metadata.mentions`
 * (ver `backend/src/utils/mentions.util.ts`). Acá sólo volvemos a ubicar esas
 * etiquetas dentro del texto para pintarlas: no se decide nada de permisos ni
 * de destinatarios en el cliente.
 *
 * Ubicamos por texto y no por el `offset` guardado porque el markdown se
 * renderiza en varios nodos y esos offsets son sobre el body crudo.
 */

const ES_ALFANUM = /[\p{L}\p{N}]/u;

function esBorde(char: string | undefined): boolean {
  if (char === undefined) return true;
  return !ES_ALFANUM.test(char) && char !== '_';
}

/** Lee las menciones que el backend guardó en metadata, validando la forma. */
export function readMentions(metadata: Record<string, unknown> | null | undefined): MessageMention[] {
  const crudas = (metadata as { mentions?: unknown } | null | undefined)?.mentions;
  if (!Array.isArray(crudas)) return [];
  return crudas.filter(
    (m): m is MessageMention =>
      !!m && typeof m === 'object' &&
      typeof (m as MessageMention).user_id === 'string' &&
      typeof (m as MessageMention).label === 'string',
  );
}

export interface SegmentoTexto {
  texto: string;
  /** Presente cuando el segmento es una mención (`texto` incluye la arroba). */
  mencion?: MessageMention;
}

/**
 * Parte un texto en tramos planos y tramos de mención. Mismo criterio de match
 * que el backend: la arroba abre palabra, la etiqueta compara sin distinguir
 * mayúsculas y tiene que terminar en un borde de palabra.
 */
export function segmentarMenciones(texto: string, menciones: MessageMention[]): SegmentoTexto[] {
  if (!texto || menciones.length === 0 || !texto.includes('@')) return [{ texto }];

  // De más larga a más corta: "@Ana María" gana sobre "@Ana".
  const etiquetas = [...menciones]
    .sort((a, b) => b.label.length - a.label.length)
    .map((m) => ({ mencion: m, lower: m.label.toLowerCase() }));

  const segmentos: SegmentoTexto[] = [];
  let desde = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== '@') continue;
    if (i > 0 && ES_ALFANUM.test(texto[i - 1])) continue;

    const encontrada = etiquetas.find((e) =>
      texto.substr(i + 1, e.mencion.label.length).toLowerCase() === e.lower &&
      esBorde(texto[i + 1 + e.mencion.label.length]),
    );
    if (!encontrada) continue;

    const fin = i + 1 + encontrada.mencion.label.length;
    if (i > desde) segmentos.push({ texto: texto.slice(desde, i) });
    segmentos.push({ texto: texto.slice(i, fin), mencion: encontrada.mencion });
    desde = fin;
    i = fin - 1;
  }
  if (desde < texto.length) segmentos.push({ texto: texto.slice(desde) });
  return segmentos.length ? segmentos : [{ texto }];
}

// ── Plugin remark ────────────────────────────────────────────────────────────
// En markdown el texto llega partido en nodos (párrafos, listas, énfasis…), así
// que en vez de tocar el string crudo transformamos los nodos `text`: cada
// mención se convierte en un `link` con url `mention:<uuid>`, y MessageBody lo
// pinta como chip desde el componente `a` que ya tenía. Los nodos `inlineCode` y
// `code` no tienen hijos de texto, así que las arrobas dentro de código quedan
// intactas sin hacer nada especial.

interface NodoMd {
  type: string;
  value?: string;
  url?: string;
  children?: NodoMd[];
}

export const MENTION_HREF_PREFIX = 'mention:';

function transformarNodo(nodo: NodoMd, menciones: MessageMention[]): void {
  if (!nodo.children?.length) return;
  const salida: NodoMd[] = [];
  let cambio = false;

  for (const hijo of nodo.children) {
    if (hijo.type === 'text' && typeof hijo.value === 'string' && hijo.value.includes('@')) {
      const segmentos = segmentarMenciones(hijo.value, menciones);
      if (segmentos.some((s) => s.mencion)) {
        cambio = true;
        for (const seg of segmentos) {
          salida.push(seg.mencion
            ? {
                type: 'link',
                url: `${MENTION_HREF_PREFIX}${seg.mencion.user_id}`,
                children: [{ type: 'text', value: seg.texto }],
              }
            : { type: 'text', value: seg.texto });
        }
        continue;
      }
    }
    // Los links ya existentes no se tocan: una mención adentro de la etiqueta
    // de un link anidaría <a> dentro de <a>.
    if (hijo.type !== 'link') transformarNodo(hijo, menciones);
    salida.push(hijo);
  }

  if (cambio) nodo.children = salida;
}

/** Attacher de remark listo para `remarkPlugins`. */
export function remarkMentions(menciones: MessageMention[]) {
  return function attacher() {
    return function transformer(arbol: NodoMd) {
      if (menciones.length > 0) transformarNodo(arbol, menciones);
    };
  };
}
