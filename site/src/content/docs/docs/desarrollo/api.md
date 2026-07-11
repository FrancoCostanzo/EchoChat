---
title: API REST
description: Referencia de endpoints HTTP por módulo bajo /api.
---

## Convenciones generales

- Todas las rutas viven bajo el prefijo `/api`.
- Autenticación: header `Authorization: Bearer <jwt>`, validado por el middleware
  `authenticate`. Las rutas públicas se indican explícitamente abajo.
- Autorización: algunos endpoints requieren un permiso RBAC específico
  (`requirePermission`); ver [RBAC](/docs/admin/rbac).
- Formato de respuesta: `{ "status": "success", "data": ... }` o
  `{ "status": "error", "message": "...", "details": [...] }`.
- Validación de entrada con esquemas Joi (DTOs) antes del controller.

## Auth — `/api/auth`

| Método | Ruta | Acceso |
|--------|------|--------|
| `GET` | `/registration-status` | Público |
| `POST` | `/register` | Público |
| `POST` | `/login` | Público |
| `POST` | `/2fa/challenge` | Público (segundo paso del login) |
| `POST` | `/logout`, `/logout-all` | Autenticado |
| `GET` | `/me` | Autenticado |
| `PUT` | `/password` | Autenticado |
| `GET` | `/sessions`, `DELETE /sessions/:sessionId` | Autenticado |
| `POST` | `/2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/backup-codes/regenerate` | Autenticado |

## Users — `/api/users`

| Método | Ruta |
|--------|------|
| `GET` / `PUT` | `/me` |
| `POST` | `/me/avatar` |
| `PUT` | `/me/presence` |
| `GET` | `/search`, `/:userId` |

## Conversations — `/api/conversations`

| Método | Ruta |
|--------|------|
| `POST` / `GET` | `/` |
| `GET` / `PUT` | `/:conversationId` |
| `GET` / `POST` | `/:conversationId/members` |
| `PUT` / `DELETE` | `/:conversationId/members/:userId` |
| `POST` | `/:conversationId/read` |

## Messages — `/api/messages`

| Método | Ruta |
|--------|------|
| `POST` | `/` |
| `GET` | `/saved`, `/drafts`, `/:messageId`, `/:messageId/thread`, `/:messageId/info` |
| `PUT` / `DELETE` | `/:messageId` |
| `POST` / `DELETE` | `/:messageId/reactions[/:emoji]` |
| `POST` | `/:messageId/receipts`, `/:messageId/save`, `/:messageId/forward` |
| `GET` | `/conversation/:id`, `/conversation/:id/search`, `/conversation/:id/pinned` |
| `POST` / `DELETE` | `/conversation/:id/pin/:messageId` |
| `GET` / `PUT` / `DELETE` | `/conversation/:id/draft` |

## Channels — `/api/channels`

| Método | Ruta | Permiso |
|--------|------|---------|
| `GET` | `/discover` | Autenticado |
| `POST` | `/` | `groups.create` |
| `GET` | `/:conversationId` | Autenticado |
| `PUT` | `/:conversationId/settings` | Owner/admin del canal |
| `POST` | `/:conversationId/join` | Autenticado |
| `GET` / `PUT` | `/:conversationId/requests[/:requestId]` | Gestores del canal |

## Polls — `/api/polls`

| Método | Ruta |
|--------|------|
| `POST` | `/` |
| `POST` / `DELETE` | `/:pollId/vote` |
| `POST` | `/:pollId/close` |

## Calls — `/api/calls`

| Método | Ruta |
|--------|------|
| `POST` | `/` |
| `GET` | `/active`, `/history`, `/conversation/:id`, `/:callId` |
| `PUT` | `/:callId/status`, `/:callId/participants/:userId` |

## Storage — `/api/storage`

| Método | Ruta | Permiso |
|--------|------|---------|
| `POST` | `/upload`, `/upload-url` | `media.upload` |
| `GET` | `/stickers` | Autenticado (colección propia) |
| `DELETE` | `/stickers/:objectId` | Autenticado (solo dueño) |
| `GET` | `/:objectId`, `/:objectId/url` | Autenticado |
| `DELETE` | `/:objectId` | Autenticado |

## Broadcasts — `/api/broadcasts`

| Método | Ruta | Permiso |
|--------|------|---------|
| `POST` / `GET` | `/` | `broadcast.create` (POST) |
| `GET` | `/:listId`, `/:listId/messages` | Autenticado |
| `POST` / `DELETE` | `/:listId/recipients[/:userId]` | `broadcast.create` |
| `POST` | `/:listId/messages` | `broadcast.send` |

## Notifications — `/api/notifications`

| Método | Ruta |
|--------|------|
| `GET` | `/`, `/count`, `/preferences` |
| `POST` | `/read-all` |
| `PUT` | `/:notificationId/read`, `/preferences` |

## Relationships — `/api/relationships`

| Método | Ruta |
|--------|------|
| `POST` | `/` |
| `DELETE` | `/:targetId/:type` |
| `GET` | `/contacts`, `/blocked`, `/favorites` |

## Admin — `/api/admin`

| Método | Ruta | Permiso |
|--------|------|---------|
| `GET` / `POST` / `PATCH` / `DELETE` | `/users[/:userId]`, `/users/:userId/password` | `admin.users` |
| `GET` | `/roles`, `/ldap/status` | `admin.users` |
| `POST` | `/ldap/sync` | `admin.users` |
| `GET` / `PUT` | `/settings[/:key]` | `admin.settings` |
| `GET` | `/audit` | `admin.view_audit` |
| `GET` | `/storage/stats`, `/storage/objects` | `admin.storage` |

## Monitoring — `/api/monitoring` y `/api/health`

| Método | Ruta | Acceso |
|--------|------|--------|
| `GET` | `/api/health/live`, `/api/health/ready` | Público |
| `GET` | `/api/monitoring/dashboard`, `/health`, `/database`, `/system` | Cualquier permiso `admin.*` |
| `GET` | `/api/monitoring/history?range=1h\|6h\|24h\|7d` | Cualquier permiso `admin.*` |

Rate limit propio de 30 peticiones/minuto sobre `/api/monitoring/*`.

## Health check

`GET /api/health` — chequeo simple (no requiere auth): estado del servidor y de la
conexión a PostgreSQL.

## Colección Bruno

Todos los endpoints tienen requests de ejemplo listos para probar en la colección Bruno
del repositorio: `tooling/bruno/`. Abrila con la app [Bruno](https://www.usebruno.com/)
para explorar y probar la API sin escribir código.
