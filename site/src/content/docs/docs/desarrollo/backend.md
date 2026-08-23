---
title: Backend
description: Capas del backend, convenciones y flujo de una petición HTTP.
---

## Stack

| Tecnología | Uso |
|------------|-----|
| **TypeScript** (estricto) | Todo `src/` — `strict: true`, compila a `dist/` con `tsc` |
| **Express 4** | API REST bajo `/api` |
| **Socket.IO 4** | Mensajería, presencia, tipeo, llamadas en tiempo real |
| **PostgreSQL** (`pg`) | Persistencia relacional |
| **MinIO** | Archivos S3-compatible |
| **Joi** | Validación de entrada en DTOs |
| **JWT + bcrypt** | Autenticación y hashing de contraseñas |
| **Pino** | Logging estructurado |
| **node-cron** | Jobs programados |

## Estructura de carpetas

```
backend/src/
├── app.ts               # Middlewares globales y montaje de rutas bajo /api
├── server.ts            # Arranque HTTP, jobs cron, shutdown graceful
├── socket.ts            # Autenticación JWT en sockets y eventos realtime
├── config/              # Pool de PostgreSQL, cliente MinIO, logger
├── routes/              # Definición de endpoints
├── controllers/         # req/res HTTP, sin lógica de negocio
├── services/            # Reglas de negocio
├── repositories/        # Queries SQL parametrizadas
├── models/              # Transformadores toXxxResponse() + tipos *Response
├── dtos/                # Esquemas Joi por operación + tipos *Request
├── types/               # db.d.ts (tipos de las tablas) y tipos compartidos
├── middlewares/         # authenticate, authorize, validate, rate limit
├── errors/              # AppError y jerarquía de errores
└── jobs/                # Tareas programadas (node-cron)
```

Las columnas de PostgreSQL se tipan en `types/db.d.ts`, generado con `npm run db:types`
(`backend/scripts/generate-db-types.js`) a partir del schema real — no se escribe a mano.

## Flujo Route → Repository

```
Route → validate(dto) → authenticate → authorize → Controller → Service → Repository → PostgreSQL
                                                          ↓
                                                    Model (transform)
                                                          ↓
                                                     Response JSON
```

Un controller **nunca** llama directo a un repository — siempre pasa por el service
correspondiente.

## DTOs y validación

Cada módulo tiene un archivo `*.dto.ts` con los esquemas Joi de sus operaciones,
aplicados por el middleware `validate(dto)` antes de llegar al controller:

```typescript
const registerDto = Joi.object({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});
```

## Errores y logging

- Los services lanzan `AppError` o una subclase (`NotFoundError`, `ConflictError`,
  `UnauthorizedError`, `ForbiddenError`, `BadRequestError`); el middleware
  `errorHandler` centraliza la respuesta HTTP.
- Logging estructurado con **Pino**, niveles `trace`→`fatal` según `LOG_LEVEL`; headers
  sensibles (`Authorization`, `Cookie`) se redactan automáticamente.
- Formato de respuesta consistente: `{ status: 'success', data }` o
  `{ status: 'error', message, details? }`.

## RBAC en middlewares

- `authenticate` — valida el JWT del header `Authorization: Bearer <token>` y adjunta
  `req.user`/`req.session`.
- `authorize.requirePermission(...codes)` / `requireRole(...names)` — verifican permisos
  o roles globales; `super_admin` bypasea siempre. Ver [RBAC](/docs/admin/rbac).
- Roles por conversación se verifican dentro del service correspondiente, no en un
  middleware global.

## Jobs programados

Registrados en `backend/src/jobs/index.ts` con `node-cron`, arrancan y se detienen junto
al servidor HTTP (`server.ts`):

| Job | Frecuencia | Qué hace |
|-----|------------|----------|
| `presence-timeout` | cada minuto | Pasa usuarios `online` inactivos a `away` |
| `presigned-cleanup` | cada 15 min | Elimina URLs prefirmadas expiradas de la caché |
| `scheduled-broadcasts` | cada minuto | Despacha difusiones con `scheduled_at` vencido |
| `monitoring-snapshot` | cada 5 min | Guarda un snapshot de métricas para las tendencias del dashboard |

El estado de ejecución de cada job es visible en tiempo real en
[Monitoreo](/docs/admin/monitoreo#cron-y-socketio).

## Convenciones de código

- Archivos: `camelCase.tipo.ts` (`message.service.ts`, `user.repository.ts`).
- Código en `camelCase`; columnas de BD en `snake_case`.
- Módulos ES (`import`/`export`), no CommonJS; servicios y repositorios se exportan como
  singleton.
- Repositorios extienden `BaseRepository`; queries parametrizadas (`$1, $2, ...`), nunca
  interpolación de strings.
- Soft delete: los registros se marcan como eliminados, nunca se borran físicamente.

Ver el detalle completo (ejemplos de código por capa) en `docs/STYLE_GUIDE.md` del
repositorio.

## Arrancar en desarrollo

```bash
cd backend
cp .env.example .env    # Ajustar DB_*, JWT_SECRET, MinIO, CORS
npm install
npm run dev              # tsx watch + pino-pretty en :3000
```

Health check: `GET http://localhost:3000/api/health`. Probar endpoints con la colección
Bruno en `tooling/bruno/` (ver [API REST](/docs/desarrollo/api#colección-bruno)).
