---
title: Variables de entorno
description: Referencia completa de variables de entorno para backend y Docker Compose.
---

## Archivos de configuración

| Archivo | Cuándo se usa |
|---------|---------------|
| `backend/.env` | Desarrollo local sin Docker (copiar desde `backend/.env.example`) |
| `.env` (raíz del repo) | Despliegue con Docker Compose (copiar desde `.env.example`) |

El backend carga las variables con `dotenv` en `backend/src/config/index.js`. Nunca
commitees el archivo `.env` real.

## General y servidor

| Variable | Default | Descripción |
|----------|---------|--------------|
| `NODE_ENV` | `development` | `development` \| `production` \| `test`. Afecta logs y mensajes de error |
| `PORT` | `3000` | Puerto de Express + Socket.IO |

## PostgreSQL

| Variable | Default | Descripción |
|----------|---------|--------------|
| `DB_HOST` | `localhost` | `postgres` en Docker todo-en-uno |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `echochat` | |
| `DB_USER` | `echochat` | |
| `DB_PASSWORD` | — | ⚠️ Cambiar en producción |
| `DB_POOL_MIN` | `2` | Conexiones mínimas del pool |
| `DB_POOL_MAX` | `20` | Conexiones máximas del pool |

`DATABASE_URL` (opcional, comentada por defecto) solo se usa para herramientas externas
como el MCP de PostgreSQL en Cursor — el backend **no** la lee directamente.

## JWT y autenticación

| Variable | Default | Descripción |
|----------|---------|--------------|
| `JWT_SECRET` | — | ⚠️ Obligatoria. Generar con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` | Duración del access token |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Duración del refresh token |
| `MESSAGE_ENC_KEY` | — | ⚠️ Obligatoria. Clave AES-256-GCM (32 bytes en base64) para cifrar mensajes en reposo. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **El backend no arranca sin ella; si se pierde, se pierden todos los mensajes** |
| `MESSAGE_ENC_KEY_ID` | `v1` | Identificador de versión de clave (para rotación) |

## Primer administrador y migraciones

En el primer arranque el backend prepara la base (esquema + migraciones + seed) y crea el
primer `super_admin` si no existe ninguno. Ver [Base de datos](/docs/despliegue/base-de-datos).

| Variable | Default | Descripción |
|----------|---------|--------------|
| `ADMIN_USERNAME` | — | Usuario del primer administrador. Si falta, no se crea (habrá que hacerlo a mano) |
| `ADMIN_PASSWORD` | — | Contraseña del primer administrador. Cambiala tras el primer login |
| `ADMIN_DISPLAY_NAME` | `Administrador` | Nombre visible del primer administrador |
| `ADMIN_EMAIL` | — | Email opcional del primer administrador |
| `RUN_MIGRATIONS_ON_BOOT` | `true` | Aplicar esquema + migraciones + seed al arrancar. `false` para hacerlo manual con `npm run migrate` |

## Identidad e integraciones

Opcionales. Habilitan directorio corporativo, SSO y aprovisionamiento automático.
Funcionan tanto en `backend/.env` como en el `.env` de Docker. La guía conceptual está en
[Integraciones](/docs/admin/integraciones).

**LDAP / Active Directory:**

| Variable | Default | Descripción |
|----------|---------|--------------|
| `LDAP_ENABLED` | `false` | Habilita login/importación contra un directorio LDAP/AD |
| `LDAP_URL` | — | `ldap://` o `ldaps://` |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | — | Cuenta de servicio de solo lectura |
| `LDAP_BASE_DN` | — | Base de búsqueda de usuarios |
| `LDAP_USER_FILTER` | `(objectClass=person)` | Filtro de búsqueda, con `{{username}}` |
| `LDAP_ATTR_*` | — | Mapeo de atributos (usuario, nombre, email, departamento, cargo, grupos, ID externo) |
| `LDAP_TIMEOUT_MS` | `10000` | Timeout de conexión/consulta |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | `true` | Poner en `false` solo con certificados autofirmados |
| `LDAP_SYNC_ENABLED` / `LDAP_SYNC_CRON` | `false` / `0 */6 * * *` | Sincronización automática periódica |
| `LDAP_DEPROVISION` | `false` | Deshabilitar usuarios ausentes del directorio y revocar sus sesiones |
| `LDAP_SYNC_ROLES` / `LDAP_GROUP_ROLE_MAP` | `false` / — | Mapear grupos (`memberOf`) a roles de EchoChat |
| `LDAP_DEFAULT_ROLE` | `user` | Rol de los usuarios importados |

**SSO / OpenID Connect** (Azure AD, Google Workspace, Okta):

| Variable | Default | Descripción |
|----------|---------|--------------|
| `OIDC_ENABLED` | `false` | Habilita el login federado |
| `OIDC_PROVIDERS` | — | Lista de proveedores, ej. `azure,google` |
| `OIDC_<NOMBRE>_ISSUER` / `_CLIENT_ID` / `_CLIENT_SECRET` | — | Credenciales por proveedor (discovery OIDC) |
| `OIDC_<NOMBRE>_LABEL` / `_SCOPES` | (nombre) / `openid profile email` | Texto del botón y scopes |
| `OIDC_REDIRECT_BASE` | (deriva del request) | Base pública del backend para el `redirect_uri` |
| `OIDC_DEFAULT_ROLE` | `user` | Rol de los usuarios creados por SSO |

**SCIM 2.0** (aprovisionamiento automático desde Okta/Azure):

| Variable | Default | Descripción |
|----------|---------|--------------|
| `SCIM_ENABLED` | `false` | Habilita el endpoint `/scim/v2` |
| `SCIM_TOKEN` | — | ⚠️ Bearer token estático que presenta el IdP (largo y secreto) |
| `SCIM_DEFAULT_ROLE` | `user` | Rol de los usuarios aprovisionados |

## MinIO y almacenamiento

| Variable | Default | Descripción |
|----------|---------|--------------|
| `MINIO_ENDPOINT` | `localhost` | `minio` en Docker todo-en-uno |
| `MINIO_PORT` | `9000` | |
| `MINIO_ACCESS_KEY` | `minioadmin` | ⚠️ Cambiar en producción |
| `MINIO_SECRET_KEY` | `minioadmin` | ⚠️ Cambiar en producción |
| `MINIO_USE_SSL` | `false` | |
| `MINIO_PUBLIC_ENDPOINT` | (usa `MINIO_ENDPOINT`) | Cómo los navegadores acceden a MinIO para descargar adjuntos |
| `MINIO_PUBLIC_PORT` | (usa `MINIO_PORT`) | |
| `MINIO_PUBLIC_USE_SSL` | (usa `MINIO_USE_SSL`) | |

Ver el detalle de buckets y URLs prefirmadas en [Almacenamiento](/docs/despliegue/almacenamiento).

## CORS y red

| Variable | Default | Descripción |
|----------|---------|--------------|
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido del frontend (también usado por Socket.IO). ⚠️ No usar `*` en producción |

## Rate limiting y logging

| Variable | Default | Descripción |
|----------|---------|--------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Ventana de rate limit por IP |
| `RATE_LIMIT_MAX` | `100` | Peticiones máximas por ventana |
| `LOG_LEVEL` | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |

El dashboard de monitoreo aplica además su propio límite fijo (30 peticiones/min) sobre
`/api/monitoring/*`, independiente de `RATE_LIMIT_MAX`.

## Docker Compose

Variables adicionales solo relevantes en el `.env` de la raíz:

| Variable | Default | Descripción |
|----------|---------|--------------|
| `COMPOSE_PROFILES` | `postgres,minio` | Perfiles a levantar: `postgres`, `minio`, ambos o ninguno |
| `FRONTEND_PORT` | `80` | Puerto expuesto del frontend (Nginx) |
| `MINIO_CONSOLE_PORT` | `9001` | Puerto de la consola web de MinIO |

## Variables del frontend

El frontend en desarrollo usa el proxy de Vite (`/api` y `/socket.io` → `:3000`) y no
requiere variables `VITE_*` para funcionar localmente. En producción con Docker, el
frontend se sirve mediante Nginx, que enruta `/api` y `/socket.io` al backend sin
necesidad de configuración adicional en el cliente.

La única excepción es la pestaña de GIFs del selector de stickers (ver
[Emojis, stickers y GIFs](/docs/uso/stickers-y-gifs)), opcional:

| Variable | Default | Descripción |
|----------|---------|--------------|
| `VITE_GIPHY_API_KEY` | *(sin definir)* | Clave gratuita de [Giphy](https://developers.giphy.com). Sin ella, la pestaña de GIFs muestra un aviso para configurarla; los stickers personalizados funcionan igual. |
| `VITE_GIPHY_RATING` | `pg-13` | Clasificación máxima del contenido: `g`, `pg`, `pg-13`, `r`. |

Es una clave de **cliente** (no secreta): queda visible en el bundle del navegador.

## Ejemplos por escenario

**Desarrollo local (`backend/.env`):**

```ini
NODE_ENV=development
DB_HOST=localhost
MINIO_ENDPOINT=localhost
CORS_ORIGIN=http://localhost:5173
```

**Docker todo-en-uno (`.env` raíz):**

```ini
COMPOSE_PROFILES=postgres,minio
DB_HOST=postgres
MINIO_ENDPOINT=minio
MINIO_PUBLIC_ENDPOINT=192.168.1.100
CORS_ORIGIN=http://192.168.1.100
```

**BD y storage externos (`.env` raíz):**

```ini
COMPOSE_PROFILES=
DB_HOST=10.0.1.50
MINIO_ENDPOINT=10.0.1.51
MINIO_PUBLIC_ENDPOINT=10.0.1.51
```

Ver más combinaciones en [Despliegue con Docker](/docs/despliegue).
