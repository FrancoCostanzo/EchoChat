# 🗺️ EchoChat — Roadmap a Plataforma Empresarial Completa

> Objetivo: cerrar la brecha entre lo que el schema/README prometen y lo implementado,
> con foco en caso de uso **intranet corporativa** (canales, broadcasts, RBAC, audit, push).
> Esfuerzo total aprox: **95-115 días-dev**. Bloque "se siente empresarial" (Fases 0-3): **35-45 días**.

## Estado de avance

| Fase | Tema | Estado |
|------|------|--------|
| 0 | Cimientos transversales | ✅ Hecho (base) |
| 1 | Canales | ✅ Hecho |
| 2 | Notificaciones push + email | ⬜ Pendiente |
| 3 | Broadcasts completos | ⬜ Pendiente |
| 4 | Pipeline de media seguro | ⬜ Pendiente |
| 5 | Llamadas WebRTC reales | ⬜ Pendiente |
| 6 | Mensajería ya modelada (quick wins) | 🚧 En progreso |
| 7 | Panel de administración | ⬜ Pendiente |

Orden recomendado:
```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → (Fase 6 en paralelo) → Fase 4 → Fase 7 → Fase 5
```

---

## FASE 0 — Cimientos transversales (bloquean todo lo demás)

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 0.1 | **Enforcement de RBAC**: middleware que chequea `permissions`/roles por endpoint. | M (3-4d) | — | ✅ |
| 0.2 | **Audit log activo**: escribir en `audit_log` en acciones críticas. | S (2d) | 0.1 | ✅ base |
| 0.3 | **Infra de jobs en background** (node-cron): scheduler + jobs. | M (2-3d) | — | ✅ base |
| 0.4 | **Limpieza técnica**: quitar `console.log`, alinear README. | S (0.5d) | — | ✅ |

### Detalle de lo implementado en Fase 0

- **0.1 RBAC** ✅
  - `userRepository.getPermissionCodes/getRoleNames/hasPermission` (resuelven roles→permisos, respetando expiración).
  - `middlewares/authorize.js`: `requirePermission(...codes)` y `requireRole(...names)` (con bypass de `super_admin`); exportados en `middlewares/index.js`.
  - **Seed de `role_permissions`** (faltaba por completo): en el schema base + migración idempotente `backend/docs/migrations/001_seed_role_permissions.sql`.
  - Aplicado en: `broadcasts` (`broadcast.create`/`broadcast.send`), `storage/upload` (`media.upload`), y borrado de mensajes ajenos (`messages.delete_any`) en `message.service`.
- **0.2 Audit** ✅ base — se registra: login/register/cambio de password (ya existía) + `message.delete` + `conversation.member_role_change`. Pendiente extender a uploads y cambios de settings.
- **0.3 Jobs** ✅ base — `src/jobs/` con `node-cron`, arranque/parada en `server.js`. Jobs activos: `presence-timeout` (online→away por inactividad) y `presigned-cleanup`. Pendiente: scheduled broadcasts (Fase 3), retención de mensajes, procesamiento de media (Fase 4).
- **0.4 Limpieza** ✅ — quitado `console.log` en `chatStore.js`; README alineado (2FA documentado; thumbnails/EXIF/antivirus marcados como planificados).

> ⚠️ **Acción de despliegue requerida**: en bases de datos existentes correr la migración para
> que el RBAC tenga efecto, si no los usuarios quedarán sin permisos:
> `psql -U echochat -d echochat -f backend/docs/migrations/001_seed_role_permissions.sql`

## FASE 1 — Canales

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 1.1 | Backend de canales: endpoints sobre `channel_settings` (categoría, `post_restriction`, `join_mode`, `is_official`). | M (3d) | 0.1 | ✅ |
| 1.2 | Descubrimiento de canales: listar `is_discoverable`, búsqueda, unirse a `open`. | S (2d) | 1.1 | ✅ |
| 1.3 | Solicitudes de ingreso (`channel_join_requests`): pedir/aprobar/rechazar + notificación a admins. | M (2-3d) | 1.1 | ✅ |
| 1.4 | UI de canales: exploración, badge oficial, panel de moderación. | L (5-6d) | 1.1-1.3 | ✅ |

### Detalle de lo implementado en Fase 1 (backend)

- Módulo `channels` completo: `channel.repository`, `channel.service`,
  `channel.controller`, `channel.dto`, `channel.model`, `channel.routes`
  (montado en `/api/channels`), todo cableado en los `index.js`.
- Endpoints: `POST /channels` (requiere `groups.create`), `GET /channels/discover`
  (búsqueda + filtro por categoría, marca `is_member`/`has_pending_request`),
  `GET /channels/:id`, `PUT /channels/:id/settings` (owner/admin),
  `POST /channels/:id/join` (open=entra, request=crea solicitud, invite_only=403),
  `GET/PUT /channels/:id/requests[/:requestId]` (moderación).
- Solicitudes notifican a los gestores (in-app + socket `channel:join_request`);
  la aprobación agrega al miembro y emite `channel:joined`.
- Cliente API frontend listo (`channelsApi` en `lib/endpoints.js`).
- **UI (1.4)**: `ChannelsExplorePage` (`/channels`) con búsqueda, filtro por
  categoría, tarjetas con badge oficial y conteo de miembros, acción según
  estado (unirse / solicitar / pendiente / abrir), modal de solicitud de
  acceso y modal de moderación (aprobar/rechazar) para gestores. Botón
  "Explorar" del GuildRail conectado; i18n en es/en/pt. Build verificado.

## FASE 2 — Notificaciones reales (push + email)

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 2.1 | Web Push (VAPID): suscripción, envío respetando `notification_preferences`/`quiet_hours`. | M (3-4d) | 0.3 |
| 2.2 | Email (nodemailer + SMTP): digest de no leídos, invitaciones, reset de contraseña. | M (2-3d) | 0.3 |
| 2.3 | UI de preferencias granular por evento + horario de silencio. | S (2d) | 2.1 |

## FASE 3 — Broadcasts completos

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 3.1 | Gestión de destinatarios (`broadcast_recipients`), por departamento. | S (2d) | 0.1 |
| 3.2 | Envío programado (`scheduled_at` + worker). | M (2-3d) | 0.3 |
| 3.3 | Tracking de entrega/lectura (`broadcast_deliveries`). | M (2d) | 3.1 |
| 3.4 | UI de difusiones: crear, programar, métricas. | L (4-5d) | 3.1-3.3 |

## FASE 4 — Pipeline de media seguro

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 4.1 | Thumbnails con `sharp`/`ffmpeg`, poblando `thumbnail_key`/`processing_status`. | M (3d) | 0.3 |
| 4.2 | Strip EXIF al subir imágenes. | S (1d) | 4.1 |
| 4.3 | Escaneo antivirus (ClamAV) con `virus_scan_status`. | M (2-3d) | 0.3 |
| 4.4 | Deduplicación por SHA256 (campo+índice ya existen). | S (1d) | — |

## FASE 5 — Llamadas WebRTC reales

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 5.1 | Señalización por Socket.IO: offer/answer/ICE, `call:incoming`/`call:status`. | M (3-4d) | — |
| 5.2 | SFU para grupales (mediasoup/LiveKit/Janus), usando `server_host`/`room_id`. | L (8-10d) | 5.1 |
| 5.3 | UI de llamada: mute/cámara/screen-share, controles de host. | L (6-8d) | 5.1 |
| 5.4 | Grabación con consentimiento (`call_recordings`, `consented_by`). | M (3d) | 5.2, Fase 4 |

## FASE 6 — Mensajería ya modelada (quick wins)

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 6.1 | Drafts (`drafts`): autoguardar borrador por conversación. | S (1-2d) | — | 🚧 backend + API (falta autosave en ConversationPage) |
| 6.2 | Saved messages (`saved_messages`): guardar con nota + vista. | S (2d) | — | ✅ |
| 6.3 | Forwarding (campos `forwarded_from_*` ya existen). | S (1-2d) | — | ⬜ |
| 6.4 | Polls (`poll.dto` ya existe sin ruta): votación en vivo + UI. | M (3-4d) | — | ⬜ |
| 6.5 | Threads/hilos completos (`thread_id`). | M (3d) | — | ⬜ |

### Detalle de lo implementado en Fase 6

- **6.2 Saved messages** ✅ — backend (`saved.repository`, métodos en `messageService`,
  endpoints `GET /messages/saved`, `POST/DELETE /messages/:id/save`), acción "Guardar"
  en la toolbar de cada mensaje (`ConversationPage`), página dedicada
  `SavedMessagesPage` (`/saved`) con acceso en el GuildRail, i18n es/en/pt.
- **6.1 Drafts** 🚧 — backend completo (`draft.repository`, métodos en `messageService`,
  endpoints `GET /messages/drafts`, `GET/PUT/DELETE /messages/conversation/:id/draft`)
  y cliente API (`messagesApi`). Falta el autosave en el composer de `ConversationPage`.

## FASE 7 — Panel de administración

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 7.1 | Gestión de usuarios (alta/baja/suspensión, roles). | M (3-4d) | 0.1 |
| 7.2 | Editor de `system_settings`. | S (2d) | 0.1 |
| 7.3 | Visor de audit log con filtros. | S (2d) | 0.2 |
| 7.4 | Dashboard de storage MinIO. | M (2-3d) | 0.1 |
