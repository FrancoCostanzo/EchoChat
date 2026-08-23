/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clave de la API de Giphy (opcional: sin ella, el tab de GIFs queda deshabilitado). */
  readonly VITE_GIPHY_API_KEY?: string;
  /** Rating de contenido para las búsquedas de Giphy (default 'pg-13'). */
  readonly VITE_GIPHY_RATING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
