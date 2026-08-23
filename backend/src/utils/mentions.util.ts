// ──────────────────────────────────────────────────────────────────────────────
// Resolución de @menciones.
//
// El parseo se hace SIEMPRE en el servidor contra los miembros reales de la
// conversación: el cliente podría mandar un `metadata.mentions` inventado para
// notificar a gente que no está en el chat, así que lo que llegue en metadata se
// descarta y se recalcula acá.
//
// Criterio de match: `@` que abre palabra, seguida del display_name o el username
// de un miembro, comparando sin distinguir mayúsculas pero SIN plegar acentos.
// Lo segundo es a propósito: el autocompletado del composer inserta el nombre
// exacto, y comparar sobre el texto original mantiene los offsets fiables (quitar
// diacríticos cambia el largo de la cadena y los desplazaría).
// ──────────────────────────────────────────────────────────────────────────────

export interface Mencion {
  user_id: string;
  /** Texto escrito, sin la arroba ("María García" o "mgarcia"). */
  label: string;
  /** Posición de la `@` dentro del body. */
  offset: number;
  /** Largo del token completo, arroba incluida. */
  length: number;
}

export interface MiembroMencionable {
  user_id: string;
  username?: string | null;
  display_name?: string | null;
}

/** Tope defensivo: un body de 10k caracteres lleno de arrobas no debe generar 500 notificaciones. */
const MAX_MENCIONES = 50;

const ES_ALFANUM = /[\p{L}\p{N}]/u;

/** Una mención termina donde termina la palabra: `@ana` no matchea dentro de `@anabella`. */
function esBorde(char: string | undefined): boolean {
  if (char === undefined) return true;
  return !ES_ALFANUM.test(char) && char !== '_';
}

export function resolverMenciones(
  body: string | null | undefined,
  miembros: MiembroMencionable[],
): Mencion[] {
  if (!body || !body.includes('@') || !miembros?.length) return [];

  // Etiquetas de más larga a más corta: si "Ana" y "Ana María" son miembros,
  // "@Ana María" tiene que resolver a la segunda, no a la primera.
  const etiquetas: { userId: string; label: string; lower: string }[] = [];
  for (const miembro of miembros) {
    if (!miembro?.user_id) continue;
    for (const candidato of [miembro.display_name, miembro.username]) {
      const label = (candidato ?? '').trim();
      if (label) etiquetas.push({ userId: miembro.user_id, label, lower: label.toLowerCase() });
    }
  }
  if (etiquetas.length === 0) return [];
  etiquetas.sort((a, b) => b.label.length - a.label.length);

  const menciones: Mencion[] = [];
  for (let i = 0; i < body.length && menciones.length < MAX_MENCIONES; i++) {
    if (body[i] !== '@') continue;
    // `juan@empresa.com` no es una mención: la arroba tiene que abrir palabra.
    if (i > 0 && ES_ALFANUM.test(body[i - 1])) continue;

    const encontrada = etiquetas.find((e) =>
      body.substr(i + 1, e.label.length).toLowerCase() === e.lower &&
      esBorde(body[i + 1 + e.label.length]),
    );
    if (!encontrada) continue;

    menciones.push({
      user_id: encontrada.userId,
      label: encontrada.label,
      offset: i,
      length: encontrada.label.length + 1,
    });
    i += encontrada.label.length; // saltamos el token ya consumido
  }
  return menciones;
}

/** Destinatarios únicos de una lista de menciones, sin el propio autor. */
export function destinatariosDeMenciones(menciones: Mencion[], autorId: string): string[] {
  return [...new Set(menciones.map((m) => m.user_id))].filter((id) => id !== autorId);
}
