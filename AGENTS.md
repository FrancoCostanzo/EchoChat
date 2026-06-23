# EchoChat — Instrucciones para el agente

Plataforma de mensajería empresarial en tiempo real: Node.js + Express + Socket.IO + PostgreSQL + MinIO (backend) y React 19 + Vite + Tailwind + HeroUI + Zustand (frontend).

## Antes de cambiar código

1. Lee el contexto del área que vas a tocar (`backend/src/` o `frontend/src/`).
2. Sigue las convenciones detalladas en `docs/STYLE_GUIDE.md`.
3. Mantén el diff mínimo: no refactorices ni documentes cosas no pedidas.

## Git / commits

- **Nunca crear PRs**: los hace el usuario manualmente.
- **No ejecutar `git commit` ni `git push`** sin pedido explícito del usuario.
- Cuando el usuario pida commit, usar la nomenclatura: **`Tipo <emoji>: descripción en español`** (la descripción explica el **por qué**).

| Tipo | Emoji | Uso | Ejemplo |
|------|-------|-----|---------|
| Feat | 🆕 | Funcionalidad nueva | `Feat 🆕: Nuevo menú para crear un usuario` |
| Fix | 🔧 | Corrección de error | `Fix 🔧: corregir cálculo de stock mínimo` |
| Fix | 🐛 | Bug / hotfix | `Fix 🐛: resolver crash en login LDAP` |
| Refactor | ♻️ | Refactor sin cambio funcional | `Refactor ♻️: extraer lógica a service` |
| Style | 🎨 | Formato/estilo de código | `Style 🎨: ordenar imports en routesConfig` |
| Docs | 🗒️ | Documentación | `Docs 🗒️: actualizar README con nuevas rutas` |
| Clean | 🧹 | Mantenimiento | `Clean 🧹: actualizar dependencias` |
| Perf | ⚡ | Mejora de rendimiento | `Perf ⚡: optimizar query con índice` |
| Release | 🎉 | Nueva versión de producción | `Release 🎉: v3.0.2` |
| Test | ✅ | Agregar o corregir tests | `Test ✅: tests para notificaciones` |
| Dependencies | 📦 | Actualización de dependencias | `Dependencies 📦: actualizar mssql a v12` |

Ramas desde `develop`: `feat/`, `fix/`, `refactor/`, etc. en kebab-case. No commitear directo a `main`.

## Comandos de desarrollo

```bash
# Backend (puerto 3000)
cd backend && npm install && npm run dev

# Frontend (puerto 5173, proxy a /api y /socket.io)
cd frontend && npm install && npm run dev

# Esquema de BD (solo si falta)
psql -U echochat -d echochat -f backend/docs/messaging_intranet_schema.sql
```

Variables de entorno: `backend/.env` en desarrollo; `.env` en la raíz para Docker. Ver `README.md`.

## Backend

### Estructura (`backend/src/`)

| Carpeta | Responsabilidad |
|---------|-----------------|
| `routes/` | Definición de endpoints HTTP |
| `controllers/` | Manejo de req/res; sin lógica de negocio |
| `services/` | Lógica de negocio |
| `repositories/` | SQL y acceso a datos (PostgreSQL vía `pg`) |
| `models/` | Transformadores de respuesta (`toXxxResponse`) |
| `dtos/` | Validación Joi |
| `middlewares/` | Auth JWT, RBAC, rate limit, validación, errores |
| `errors/` | Clases de error (`AppError`, etc.) |
| `config/` | DB, MinIO, logger |
| `jobs/` | Tareas programadas (cron) |
| `socket.js` | Eventos Socket.IO en tiempo real |

### Flujo obligatorio

```
Route → validate(dto) → authenticate → authorize → Controller → Service → Repository → PostgreSQL
```

### Convenciones

- Archivos: `camelCase.tipo.js` (`message.service.js`).
- Código JS: `camelCase`. Columnas BD: `snake_case`.
- Validar entrada con Joi en DTOs antes del controller.
- Errores HTTP vía `AppError` y `errorHandler` middleware.
- No saltarse capas (controller → repository directo).
- Logs con **Pino**; no usar `console.log` en producción.

### Módulos principales

Auth, users, conversations, messages, calls, storage (MinIO), broadcasts, notifications, relationships, polls, channels.

## Frontend

### Estructura (`frontend/src/`)

| Carpeta | Responsabilidad |
|---------|-----------------|
| `pages/` | Vistas por ruta (lazy-loaded) |
| `layouts/` | Shell de la app (`ChatLayout`, etc.) |
| `components/` | UI reutilizable |
| `stores/` | Estado global Zustand (`authStore`, `chatStore`, `themeStore`) |
| `lib/` | `api.js`, `socket.js`, `endpoints.js`, i18n |
| `locales/` | Traducciones `es.json`, `en.json`, `pt.json` |

### Convenciones

- Alias `@/` → `src/` (Vite).
- Componentes funcionales; props destructuradas; `export default`.
- Estado: selectores atómicos Zustand — `useAuthStore((s) => s.user)`.
- UI: **HeroUI 3** + **Tailwind CSS 4** + **Lucide** icons.
- Animaciones: **Framer Motion** cuando aplique.
- API REST vía `lib/api.js`; tiempo real vía `lib/socket.js` (proxy Vite a `:3000`).

### Internacionalización (obligatorio)

Todo texto visible al usuario en **es**, **en** y **pt**. Usar `useTranslation()`; no hardcodear strings en JSX.

### HeroUI

Consultar props y patrones con el MCP `heroui-react` antes de inventar componentes custom equivalentes.

## MCP (Model Context Protocol)

Configuración: `.cursor/mcp.json`. Tras editar, **reiniciar Cursor**. Verificar en **Settings → Tools & MCP**. Logs: Output → **MCP Logs**.

| Servidor | Uso |
|----------|-----|
| `heroui-react` | Docs, props y estilos de componentes HeroUI |
| `postgres-echochat` | Consultas read-only al esquema y datos de PostgreSQL |

**PostgreSQL MCP:** requiere `DATABASE_URL` en `backend/.env`:

```env
DATABASE_URL=postgresql://echochat:tu_password@localhost:5432/echochat
```

Usa la misma BD que el backend. No commitear `.env` ni credenciales en `mcp.json`.

## Qué evitar

- Strings de UI sin traducir.
- Cambiar Docker, CI o dependencias sin que lo pidan.
- Ampliar el alcance con “mejoras” no solicitadas.
- Crear PRs, commits o push sin pedido explícito.

## Referencias

- `README.md` — setup, API, sockets, despliegue Docker, Git
- `docs/SPATIAL_CANVAS.md` — sistema visual **Lienzo Espacial** (tokens, layout, componentes)
- `docs/STYLE_GUIDE.md` — convenciones completas
- `docs/ROADMAP.md` — funcionalidades planificadas
- `tooling/bruno/` — colección Bruno para probar la API
