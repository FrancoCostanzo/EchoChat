---
title: Frontend
description: Estructura del frontend React, stores Zustand y convenciones UI.
---

## Stack

| Tecnología | Uso |
|------------|-----|
| **React 19** | UI declarativa, rutas lazy-loaded |
| **Vite** | Dev server, HMR, build de producción |
| **Tailwind CSS 4** | Estilos utility-first |
| **HeroUI 3** | Componentes accesibles (Button, Modal, Input, Tabs, ...) |
| **Zustand** | Estado global por dominio |
| **React Router** | Navegación SPA |
| **Socket.IO Client** | Eventos en tiempo real |
| **i18next** | Español, inglés, portugués |
| **Framer Motion** | Transiciones y animaciones |
| **Lucide React** | Iconografía |

## Estructura de carpetas

```
frontend/src/
├── App.jsx             # Rutas y providers
├── main.jsx            # Punto de entrada
├── index.css           # Tokens CSS, tema claro/oscuro, acentos
├── pages/               # Vistas por ruta (lazy-loaded)
├── layouts/             # ChatLayout y shells
├── components/          # UI reutilizable (ServerOrbitDock, ThreadPanel, ...)
├── stores/              # authStore, chatStore, callStore, themeStore, wallpaperStore
├── lib/                 # api.js, socket.js, endpoints.js, i18n
└── locales/             # es.json · en.json · pt.json
```

## Rutas y layouts

Las páginas se cargan con `lazy()` en `App.jsx` para code splitting. Las rutas
autenticadas viven dentro de `ProtectedRoute` + `ChatLayout` (el shell con el dock
lateral y la barra de conversaciones). El panel de administración usa sus propias rutas
`/admin/:section`.

## Stores Zustand

Un store por dominio, con selectores atómicos (`useStore((s) => s.campo)`, nunca
desestructurar todo el store):

| Store | Responsabilidad |
|-------|-------------------|
| `useAuthStore` | Sesión JWT, login/logout, registro, 2FA pendiente |
| `useChatStore` | Conversaciones, mensajes, eventos de socket (mensajes, typing, presencia, polls) |
| `useCallStore` | Señalización WebRTC, mute/cámara/screen share, estados de llamada |
| `useThemeStore` | Tema claro/oscuro/sistema y color de acento |
| `useWallpaperStore` | Wallpapers por scope (global, tipo, conversación) |

## API client y sockets

- `lib/api.js`: cliente singleton con inyección automática del header
  `Authorization`, métodos `get/post/put/delete/upload`.
- `lib/endpoints.js`: agrupa las llamadas por módulo (`authApi`, `messagesApi`,
  `adminApi`, etc.).
- `lib/socket.js`: singleton de Socket.IO client (`connectSocket`, `disconnectSocket`,
  `getSocket`), con el JWT en el handshake; los listeners se registran desde los stores.

## HeroUI y Tailwind

Antes de armar un componente custom equivalente a uno de HeroUI, consultá sus props y
patrones con el MCP `heroui-react` (documentación de **HeroUI v3**). Estilos con
Tailwind CSS 4 utility-first; dark mode vía clase `dark` en `<html>`; acentos vía
`data-accent` en `<html>` (ver [Spatial Canvas](/docs/desarrollo/spatial-canvas)).

## i18n obligatorio

Todo texto visible al usuario debe existir en **es**, **en** y **pt**, usando
`useTranslation()` — nunca hardcodear strings en JSX. Ver
[Internacionalización](/docs/desarrollo/i18n).

## Proxy de desarrollo

En desarrollo, Vite proxifica `/api/*` y `/socket.io/*` desde `:5173` hacia el backend en
`:3000` — no hace falta configurar CORS ni variables `VITE_*` para correr localmente.

## Convenciones de componentes

- Componentes funcionales únicamente, props destructuradas con valores por defecto,
  `export default`.
- Alias `@/` → `src/` (configurado en `vite.config.js`).
- `memo()` para componentes de alto costo de render (ítems de lista, por ejemplo).
- Formularios: inputs controlados, validación *touch-based* (errores tras el `blur`),
  estado separado para errores de servidor.

## Build de producción

```bash
cd frontend
npm install
npm run build      # genera dist/ estático
npm run preview    # sirve el build localmente para verificar
```

En Docker, el build se sirve mediante Nginx, que también hace de proxy de `/api` y
`/socket.io` hacia el backend (ver [Despliegue con Docker](/docs/despliegue)).
