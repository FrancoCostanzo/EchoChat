const API_BASE = '/api';

class ApiClient {
  #token = null;

  setToken(token) {
    this.#token = token;
  }

  clearToken() {
    this.#token = null;
  }

  async #request(method, path, { body, params, formData } = {}) {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }

    const headers = {};
    if (this.#token) {
      headers['Authorization'] = `Bearer ${this.#token}`;
    }

    let requestBody;
    if (formData) {
      requestBody = formData;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body: requestBody });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(error.message || 'Error de red');
      err.status = res.status;
      err.details = error.details;
      throw err;
    }

    if (res.status === 204) return null;
    return res.json();
  }

  get(path, params) {
    return this.#request('GET', path, { params });
  }

  post(path, body) {
    return this.#request('POST', path, { body });
  }

  put(path, body) {
    return this.#request('PUT', path, { body });
  }

  delete(path) {
    return this.#request('DELETE', path);
  }

  upload(path, file, fields = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, v);
    });
    return this.#request('POST', path, { formData });
  }
}

export const api = new ApiClient();
