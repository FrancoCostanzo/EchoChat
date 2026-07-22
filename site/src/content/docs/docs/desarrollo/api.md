---
title: API REST
description: Vista general de la API HTTP — convenciones, módulos y autenticación.
---

Esta página describe la API a grandes rasgos. Para la **referencia exhaustiva** de cada
endpoint (rutas, parámetros, cuerpos y ejemplos), usá la colección Bruno del repositorio
(ver el final de la página): es la fuente de verdad y acompaña al código.

## Convenciones generales

- Todas las rutas de la aplicación viven bajo el prefijo `/api`.
- **Autenticación**: header `Authorization: Bearer <jwt>`, validado por el middleware
  `authenticate`. Las rutas públicas (registro, login) se indican como tales.
- **Autorización**: algunos endpoints requieren un permiso RBAC específico
  (`requirePermission`); ver [RBAC](/docs/admin/rbac).
- **Respuesta**: `{ "status": "success", "data": ... }` o
  `{ "status": "error", "message": "...", "details": [...] }`.
- **Validación** de entrada con esquemas Joi (DTOs) antes de llegar al controller.
- **Rate limiting** por IP sobre `/api`; ver
  [Variables de entorno](/docs/despliegue/variables-entorno).

## Módulos

Cada módulo agrupa un recurso bajo su propio prefijo, con rutas REST estándar
(`GET`/`POST`/`PUT`/`PATCH`/`DELETE`) sobre el recurso y sus subrecursos.

| Módulo | Prefijo | Qué gestiona | Permiso |
|--------|---------|--------------|---------|
| Auth | `/api/auth` | Registro, login, 2FA, sesiones y SSO | Público / Autenticado |
| Users | `/api/users` | Perfil propio, avatar, presencia y búsqueda | Autenticado |
| Conversations | `/api/conversations` | DMs y grupos, miembros, marcado de lectura | Autenticado |
| Messages | `/api/messages` | Mensajes, hilos, reacciones, recibos, guardados, borradores, fijados y reenvío | Autenticado |
| Channels | `/api/channels` | Canales públicos, descubrimiento y solicitudes de ingreso | `groups.create` / gestores |
| Polls | `/api/polls` | Encuestas y votos | Autenticado |
| Calls | `/api/calls` | Registro e historial de llamadas (la señalización va por [Socket.IO](/docs/desarrollo/tiempo-real)) | Autenticado |
| Storage | `/api/storage` | Subida y descarga de archivos en MinIO (URLs prefirmadas) | `media.upload` |
| Broadcasts | `/api/broadcasts` | Listas de difusión y envíos | `broadcast.create` / `broadcast.send` |
| Notifications | `/api/notifications` | Notificaciones in-app y preferencias | Autenticado |
| Relationships | `/api/relationships` | Contactos, bloqueados y favoritos | Autenticado |
| Admin | `/api/admin` | Usuarios, roles, settings, auditoría, almacenamiento e integraciones | `admin.*` |
| Monitoring | `/api/monitoring` | Estado del servidor y la base de datos | Cualquier `admin.*` |

## Identidad federada

Además de la API bajo `/api`, la plataforma expone dos superficies de integración
empresarial (ver [Integraciones](/docs/admin/integraciones)):

- **SSO / OIDC** — `GET /api/auth/sso/:provider/login` y `/callback`. Son navegaciones del
  navegador (no llamadas autenticadas): redirigen al proveedor de identidad y vuelven con
  el token en el fragmento de la URL.
- **SCIM 2.0** — endpoint aparte en `/scim/v2` (fuera de `/api`), con su propia
  autenticación por bearer token estático y formato `application/scim+json`. Lo consumen
  Okta / Azure para aprovisionar y dar de baja usuarios.

## Health check

`GET /api/health` — chequeo simple sin autenticación: estado del servidor y de la conexión
a PostgreSQL. Las variantes `/api/health/live` y `/api/health/ready` sirven para probes de
Kubernetes/Docker.

## Colección Bruno

Todos los endpoints tienen requests de ejemplo listos para probar en la colección Bruno
del repositorio: `tooling/bruno/`. Abrila con la app [Bruno](https://www.usebruno.com/)
para explorar y probar la API sin escribir código.
