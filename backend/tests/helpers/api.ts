import { randomBytes } from 'crypto';

/** Cliente HTTP mínimo contra el servidor de test. */

export interface Respuesta<T = any> {
  status: number;
  cuerpo: any;
  texto: string;
  /** `data` de la respuesta, que es donde la API pone todo. */
  datos: T;
}

export interface OpcionesPeticion {
  method?: string;
  token?: string;
  body?: unknown;
  /** Cabeceras extra; SCIM las necesita para su content-type. */
  headers?: Record<string, string>;
  /** Sin Authorization aunque haya token: para probar el 401. */
  sinAuth?: boolean;
}

export function crearCliente(base: string) {
  return async function pedir<T = any>(ruta: string, o: OpcionesPeticion = {}): Promise<Respuesta<T>> {
    const res = await fetch(base + ruta, {
      method: o.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(o.token && !o.sinAuth ? { Authorization: `Bearer ${o.token}` } : {}),
        ...o.headers,
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    });
    const texto = await res.text();
    let cuerpo: any = null;
    try { cuerpo = JSON.parse(texto); } catch { /* respuestas sin cuerpo */ }
    return { status: res.status, cuerpo, texto, datos: cuerpo?.data ?? cuerpo };
  };
}

export type Cliente = ReturnType<typeof crearCliente>;

/** Normaliza los listados: algunos endpoints devuelven el array pelado. */
export function lista(r: Respuesta): any[] {
  const d = r.datos;
  if (Array.isArray(d)) return d;
  return d?.items ?? d?.entries ?? d?.rows ?? [];
}

let contador = 0;

/**
 * Sufijo único para nombres de usuario y recursos.
 *
 * Combina las tres cosas que hacen falta: el pid distingue los procesos (el
 * runner abre uno por archivo y corren en paralelo), el contador distingue las
 * llamadas dentro de un proceso, y los bytes aleatorios cubren el reciclado de
 * pids entre corridas sobre la misma base. Una versión anterior usaba el reloj
 * más `Math.random()` y colisionaba: dos altas en el mismo milisegundo se
 * pisaban y la segunda recibía un 409.
 */
export function sufijo(): string {
  contador += 1;
  return process.pid.toString(36) + contador.toString(36) + randomBytes(3).toString('hex');
}
