import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Sólo se compilan `main` y `preload`: el renderer NO se declara acá a propósito.
// Por eso electron-vite avisa "renderer config is missing" en cada corrida —
// es esperado, no hay nada que arreglar.
// El frontend de escritorio es el mismo `frontend/` de la web — en dev se carga
// desde su dev server de Vite y en producción se sirve el `frontend/dist` ya
// buildeado a través del protocolo `app://` (ver src/main/protocol.ts).
//
// `externalizeDepsPlugin` deja fuera del bundle sólo lo declarado en
// `dependencies` (electron-updater, que electron-builder tiene que empaquetar
// como módulo real para poder auto-actualizar). Todo lo que está en
// `devDependencies` —electron-store incluido, que es ESM-only— se bundlea
// dentro del CJS del main y así no hay que resolver módulos en runtime.
//
// Ojo con la versión de Vite: acá queda pineada en 7.x porque electron-vite 5
// todavía no acepta Vite 8. No colisiona con el frontend (Vite 8) porque son
// paquetes separados y este build sólo produce main/preload — el bundle del
// renderer lo sigue haciendo `frontend/` con su propio Vite.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {},
});
