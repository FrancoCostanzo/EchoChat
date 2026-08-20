const API_BASE = '/api';

export type ApiParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Todo endpoint exitoso del backend responde con este sobre (ver los
 * controllers, p.ej. `res.json({ status: 'success', data: ... })` en
 * backend/src/controllers/message.controller.ts). `data` falta en los
 * endpoints que sólo confirman una acción (p.ej. "Message pinned").
 */
export interface ApiEnvelope<T> {
  status: 'success';
  data: T;
  message?: string;
}

/** Para los endpoints que responden sin `data`, sólo `message`. */
export interface ApiMessageEnvelope {
  status: 'success';
  message: string;
}

/** Para el puñado de endpoints que responden sin `data` ni `message` (p.ej. POST /stickers/:id/use). */
export interface ApiStatusEnvelope {
  status: 'success';
}

/** Error de red/HTTP con el `status` y el `details` que devuelve el backend (ver errorHandler middleware). */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  body?: unknown;
  params?: ApiParams;
  formData?: FormData;
}

class ApiClient {
  #token: string | null = null;

  setToken(token: string): void {
    this.#token = token;
  }

  clearToken(): void {
    this.#token = null;
  }

  async #request<T>(method: string, path: string, { body, params, formData }: RequestOptions = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {};
    if (this.#token) {
      headers['Authorization'] = `Bearer ${this.#token}`;
    }

    let requestBody: BodyInit | undefined;
    if (formData) {
      requestBody = formData;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body: requestBody });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(error.message || 'Error de red', res.status, error.details);
    }

    if (res.status === 204) return null as T;
    const json = await res.json();
    console.log(`[API] ${method} ${path}`, json);
    return json as T;
  }

  get<T>(path: string, params?: ApiParams): Promise<T> {
    return this.#request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>('POST', path, { body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>('PUT', path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>('PATCH', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.#request<T>('DELETE', path);
  }

  upload<T>(path: string, file: File | Blob, fields: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, String(v));
    });
    return this.#request<T>('POST', path, { formData });
  }
}

export const api = new ApiClient();
