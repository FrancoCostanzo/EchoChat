# 🗺️ EchoChat — Roadmap a Plataforma Empresarial Completa

> Objetivo: cerrar la brecha entre lo que el schema/README prometen y lo implementado,
> con foco en caso de uso **intranet corporativa** (canales, broadcasts, RBAC, audit, push).
> Esfuerzo total aprox: **115-141 días-dev** (incl. Fase 8: ~20-26 d). Bloque "se siente empresarial" (Fases 0-3): **35-45 días**.

## Estado de avance

| Fase | Tema | Estado |
|------|------|--------|
| 0 | Cimientos transversales | ✅ Hecho (base) |
| 1 | Canales | ✅ Hecho |
| 2 | Notificaciones push + email | 🟡 En progreso (UI 2.3 ✅) |
| 3 | Broadcasts completos | 🟡 En progreso (3.1–3.4 base ✅) |
| 4 | Pipeline de media seguro | ⬜ Pendiente |
| 5 | Llamadas WebRTC reales | 🟡 En progreso (malla P2P ✅) |
| 6 | Mensajería ya modelada (quick wins) | ✅ Hecho |
| 7 | Panel de administración | ✅ Hecho (base) |
| 8 | Formato enriquecido y contenido | 🟡 En progreso (8.1–8.3 ✅) |

Orden recomendado:
```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → (Fase 6 en paralelo) → Fase 8 → Fase 4 → Fase 7 → Fase 5
```

> **Fase 8** puede iniciarse en paralelo con Fase 2 una vez cerrada la base de jobs (0.3).
> Esfuerzo total Fase 8: **~20-26 días-dev**.

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

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 2.0 | **Preferencias en 3 niveles + despachador único** (ver detalle abajo). | M (4-5d) | — | ✅ |
| 2.1 | Web Push (VAPID) + PWA: suscripción por dispositivo, envío respetando preferencias. | M (4-5d) | 2.0 | ✅ |
| 2.2 | Email (nodemailer + SMTP): reset de contraseña, invitaciones, alertas, digest. | M (5-6d) | 2.0, 0.3 | ✅ |
| 2.3 | UI de preferencias granular por evento + horario de silencio. | S (2d) | 2.1 | ✅ |

### Plan detallado (2.0–2.2)

**Principio:** todo configurable por el usuario, con defaults y bloqueos definidos por el admin.
Resolución de preferencias de lo más específico a lo más general:
**conversación → evento → global del usuario → defaults del admin**.

#### 2.0 Preferencias + despachador

- **Global del usuario** (tabla nueva `user_notification_settings`): horario de silencio con
  días (`quiet_days`), no molestar manual con vencimiento (1h/8h/mañana/indefinido), contenido
  del push (nombre+mensaje / solo nombre / genérico), cuándo mandar push (siempre / solo si no
  estoy activo / tras X min inactivo), sonido y tono de llamada, badge, frecuencia del digest
  por email (nunca/hora/diario a hora elegida/semanal), "email si sigue sin leer tras X min",
  idioma de los emails.
- **Por evento** (`notification_preferences`, sin los campos de horario, que hoy se duplican en
  cada fila): se suman `thread.reply`, `message.reaction`, `call.missed`, `reminder`,
  `security.alert`.
- **Por conversación**: usar `conversation_members.is_muted`/`muted_until` (existen, sin uso) +
  nuevo `notification_level` (`all`/`mentions`/`none`) + "ignorar @todos".
- **Admin** (`system_settings` + `seed.sql`): habilitar push/email en la instancia, defaults
  para usuarios nuevos y eventos **bloqueados** que el usuario no puede apagar (seguridad,
  difusiones oficiales).
- **`notificationService.notify(userId, event, payload)`**: reemplaza los `notificationRepository
  .create` sueltos (message, broadcast, channel, scheduled). Resuelve preferencias, silencios,
  DND, quiet hours en la zona del usuario y presencia (no avisa si está mirando ese chat), y
  reparte a in-app/socket, push y cola de email.
- UI: pestaña Notificaciones reorganizada (matriz evento×canal, DND, quiet hours con días,
  sonidos, privacidad, dispositivos, emails); "Notificaciones / Silenciar por…" en el panel de
  la conversación e ícono 🔕 en la lista; defaults y bloqueos en el panel de admin. i18n es/en/pt.
- ✅ **Hecho** — migración `021_notification_settings.sql` (tabla `user_notification_settings`,
  mudanza del horario de silencio, `conversation_members.notification_level`), catálogo
  `utils/notificationEvents.ts`, `notificationService.resolve/notify` usado por menciones,
  recordatorios, difusiones, canales y los eventos nuevos (respuesta en hilo, reacción, llamada
  perdida). `GET/PUT /notifications/settings`; `GET /notifications/preferences` devuelve la matriz
  resuelta + canales + defaults. En no molestar / silencio la notificación se guarda igual pero
  el aviso en vivo sale con `silent: true`. Frontend: `notificationStore` (mismas reglas para el
  aviso nativo y el sonido de mensajes comunes), sonidos sintetizados con Web Audio
  (`lib/sounds.ts`), pestaña de Ajustes nueva, sección "Notificaciones" en el detalle del chat,
  🔕 en la lista y editor de política en Admin → Sistema → notifications. Tests en
  `backend/tests/notificaciones.test.ts`.

#### 2.1 Web Push + PWA

- Backend: `web-push`, claves VAPID en `.env` (+ comando CLI para generarlas), tabla
  `push_subscriptions`; endpoints de clave pública, alta/baja de suscripción, listado de
  dispositivos y "enviar prueba". Las suscripciones 404/410 se borran solas.
- Service worker: `tag` por conversación (agrupa), acciones Responder / Marcar leído, click
  enfoca o abre el chat; llamada entrante persistente con Atender / Rechazar; `setAppBadge`.
- PWA instalable (el manifest ya existe) con aviso de instalación; en iOS el push requiere la
  app instalada (16.4+) y la UI lo explica.
- Electron mantiene sus notificaciones nativas y no se suscribe a push; el despachador evita
  duplicados con la regla "solo si no estoy activo".
- ✅ **Hecho** — `web-push` + migración `022_push_subscriptions.sql` + `npm run vapid`;
  `push.service` (formato según privacidad, TTL corto y urgencia alta para llamadas, limpieza de
  suscripciones 404/410 y tras 5 fallos), textos en es/en/pt desde `backend/src/i18n`. Push en
  mensajes comunes (sólo a quien tiene dispositivos), menciones, hilos, reacciones, llamadas
  entrantes/perdidas, difusiones, recordatorios y canales. Acciones sin sesión con token firmado
  (`POST /notifications/push/action`): "Marcar como leído" y "Rechazar" llamada; "Atender" abre la
  app con `?call=…&answer=1` y el servidor reenvía al conectar los timbres pendientes. Frontend:
  `public/sw.js`, `lib/push.ts`, `PushIntegration` (navegación desde el aviso, badge del ícono),
  tarjeta en Ajustes (activar, dispositivos, prueba, privacidad, cuándo, instalar PWA, contador).
  nginx sirve `/sw.js` sin caché. Tests en `backend/tests/notificacionesPush.test.ts`.

#### 2.2 Email

- `nodemailer` + SMTP por `.env` (`SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM`). Sin SMTP
  configurado el canal queda deshabilitado y la UI oculta los toggles.
- Cola `email_outbox` + job con reintentos y backoff (ningún request espera al SMTP).
- Plantillas HTML i18n (es/en/pt) según el idioma del usuario; link firmado de baja a la
  configuración de emails + header `List-Unsubscribe`.
- Emails: **reset de contraseña** (`password_reset_tokens` con hash, 30 min, un solo uso;
  `POST /auth/forgot-password` siempre 200 con rate limit; revoca sesiones; audit; solo cuentas
  `local`), **invitación** al crear usuario (link para definir contraseña), **alertas de
  seguridad** (login nuevo, contraseña cambiada, 2FA desactivado), **pendientes sin leer**
  (menciones/DM/llamadas perdidas tras X min) y **digest** periódico sin contenido por defecto
  (los mensajes están cifrados en reposo).
- Admin: "Probar SMTP" y registro de envíos.
- ✅ **Hecho** — `nodemailer` + migración `023_email.sql` (`email_outbox`, `password_tokens`,
  marcas `notifications.email_due_at/emailed_at`, `conversation_members.unread_email_at`,
  `last_digest_at`). `mail.service` (cola con reintentos y backoff, `data` se vacía al enviar,
  `List-Unsubscribe` one-click), plantillas HTML+texto en `src/emails/templates.ts` con textos
  es/en/pt en `src/i18n`. Jobs `email-outbox` (cada minuto) y `email-notices` (cada 5 min:
  avisos sin leer, chats sin leer; resúmenes al minuto 0). Recuperar contraseña
  (`/auth/password-reset/*`, rate limit propio, respuesta igual exista o no la cuenta, cierra
  sesiones), invitación desde Admin (alta sin contraseña + reenvío), alertas de seguridad (login
  desde dispositivo nuevo, contraseña cambiada/restablecida, 2FA desactivado). Frontend:
  `/forgot-password`, `/reset-password`, `/unsubscribe`, link en el login, tarjeta Email en
  Ajustes, invitación y tarjeta SMTP en Admin. Tests en `backend/tests/emails.test.ts`.

### Detalle de lo implementado en Fase 2 (parcial)

- **2.3 UI preferencias** ✅ — tab Notificaciones en `SettingsPage`: switches
  in-app/push/email por evento (`message.direct`, `message.group`, `message.mention`,
  `channel.join_request`, `broadcast`, `call.incoming`), horario de silencio global,
  cableado a `GET/PUT /api/notifications/preferences`, i18n es/en/pt.
- **Pendiente 2.1/2.2**: Web Push VAPID y email SMTP (los toggles push/email quedan
  guardados pero sin envío real aún).

## FASE 3 — Broadcasts completos

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 3.1 | Gestión de destinatarios (`broadcast_recipients`), por departamento. | S (2d) | 0.1 | ✅ |
| 3.2 | Envío programado (`scheduled_at` + worker). | M (2-3d) | 0.3 | ✅ |
| 3.3 | Tracking de entrega/lectura (`broadcast_deliveries`). | M (2d) | 3.1 | ✅ base |
| 3.4 | UI de difusiones: crear, programar, métricas. | L (4-5d) | 3.1-3.3 | ✅ base |

### Detalle de lo implementado en Fase 3 (base)

- **3.1 Destinatarios** ✅ — `POST/DELETE /api/broadcasts/:listId/recipients`
  (permiso `broadcast.create`); añadir por `recipient_ids` y/o `department`;
  `broadcastsApi` en frontend.
- **3.2 Envío programado** ✅ — job `scheduled-broadcasts` (cada minuto) despacha
  mensajes con `status=scheduled` y `scheduled_at <= NOW()`; envío inmediato si no
  hay fecha futura.
- **3.3 Tracking** ✅ base — `dispatchMessage` entrega por DM 1:1, registra
  `broadcast_deliveries`, actualiza `total_recipients`/`total_delivered` y notifica
  in-app. Pendiente: sincronizar `total_read` desde read receipts.
- **3.4 UI** ✅ base — `BroadcastsPage` (`/broadcasts`): crear listas, gestionar
  destinatarios, redactar, programar o enviar ya, historial con estado y métricas;
  acceso en GuildRail y Command Palette; i18n es/en/pt.

## FASE 4 — Pipeline de media seguro

| # | Funcionalidad | Esfuerzo | Depende de |
|---|---|---|---|
| 4.1 | Thumbnails con `sharp`/`ffmpeg`, poblando `thumbnail_key`/`processing_status`. | M (3d) | 0.3 |
| 4.2 | Strip EXIF al subir imágenes. | S (1d) | 4.1 |
| 4.3 | Escaneo antivirus (ClamAV) con `virus_scan_status`. | M (2-3d) | 0.3 |
| 4.4 | Deduplicación por SHA256 (campo+índice ya existen). | S (1d) | — |

## FASE 5 — Llamadas WebRTC reales

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 5.1 | Señalización por Socket.IO: offer/answer/ICE, `call:incoming`/`call:status`. | M (3-4d) | — | ✅ (malla P2P) |
| 5.1b | **Autorización de la señalización** (validar participantes en cada evento). | S (1-2d) | 5.1 | ✅ |
| 5.2 | SFU para grupales (mediasoup/LiveKit/Janus), usando `server_host`/`room_id`. | L (8-10d) | 5.1 | ⬜ |
| 5.3 | UI de llamada: mute/cámara/screen-share, controles de host. | L (6-8d) | 5.1 | ✅ base |
| 5.4 | Grabación con consentimiento (`call_recordings`, `consented_by`). | M (3d) | 5.2, Fase 4 | ⬜ |
| 5.5 | **TURN propio (coturn)** con credenciales efímeras servidas por el backend. | S–M (2d) | 5.1 | ⬜ |
| 5.6 | **Preferencias de llamadas** + cambio de dispositivo en llamada. | M (3-4d) | 2.0 | ⬜ |

### Estado actual y plan

- **Hecho:** `callStore` arma una malla P2P (un `RTCPeerConnection` por par, "perfect
  negotiation"), con voz, vídeo y compartir pantalla; el backend sólo relaya señalización
  (`call:start/accept/reject/cancel/signal/leave/media`) y persiste el ciclo de vida.
- **5.1b Seguridad:** los handlers de `socket.ts` no verificaban que el emisor perteneciera a
  la llamada: `call:start` aceptaba `calleeIds` y `from` del cliente (suplantación / timbrar a
  cualquiera), `call:accept` dejaba entrar a cualquier `callId` y `call:signal` relayaba a
  cualquier usuario. Validar contra `calls`/`call_participants` y armar `from` en el servidor.
  ✅ Hecho: `callService.getPeers` valida cada evento contra `call_participants`; timbrar y
  cancelar sólo los puede el que inició, los invitados y el `from` salen de la base, y
  `call:signal`/`call:media` sólo circulan dentro de la sala entre participantes. La API REST
  también exige ser participante (ver/actualizar estado), miembro (historial de la
  conversación, iniciar llamadas sólo a miembros), el permiso `calls.make_*` según el tipo, y
  ser quien inició para cambiar permisos de otros participantes. Tests en `api.test.ts` y
  `tiempoReal.test.ts`.
- **5.5 TURN:** hoy sólo STUN público de Google; detrás de NAT simétrico/firewall corporativo
  muchas llamadas no conectan y se consulta un servidor externo. `GET /calls/ice-servers` con
  credenciales TURN temporales (HMAC) + servicio `coturn` en Docker.
- **5.6 Preferencias:** quién puede llamarme (todos/contactos/nadie), comportamiento con DND
  (rechazar como ocupado / sonar en silencio), dispositivos por defecto con prueba de micro,
  entrar silenciado / sin cámara, supresión de ruido / cancelación de eco / ganancia
  automática, tono y volumen. En llamada: cambio de dispositivo, vista previa antes de entrar a
  grupales, llamada perdida vía el despachador (2.0) y push con timbre (2.1), y guardar
  `quality_stats`.

**Orden:** 5.1b → 2.0 → 2.1 → 2.2 → 5.5 → 5.6.

## FASE 6 — Mensajería ya modelada (quick wins)

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 6.1 | Drafts (`drafts`): autoguardar borrador por conversación. | S (1-2d) | — | ✅ |
| 6.2 | Saved messages (`saved_messages`): guardar con nota + vista. | S (2d) | — | ✅ |
| 6.3 | Forwarding (campos `forwarded_from_*` ya existen). | S (1-2d) | — | ✅ |
| 6.4 | Polls (`poll.dto` ya existe sin ruta): votación en vivo + UI. | M (3-4d) | — | ✅ |
| 6.5 | Threads/hilos completos (`thread_id`). | M (3d) | — | ✅ |

### Detalle de lo implementado en Fase 6

- **6.2 Saved messages** ✅ — backend (`saved.repository`, métodos en `messageService`,
  endpoints `GET /messages/saved`, `POST/DELETE /messages/:id/save`), acción "Guardar"
  en la toolbar de cada mensaje (`ConversationPage`), página dedicada
  `SavedMessagesPage` (`/saved`) con acceso en el GuildRail, i18n es/en/pt.
- **6.1 Drafts** ✅ — backend (`draft.repository`, `messageService`, endpoints
  `GET /messages/drafts`, `GET/PUT/DELETE /messages/conversation/:id/draft`) +
  autosave con debounce en el composer de `ConversationPage` (carga al entrar,
  guarda al escribir, borra al enviar).
- **6.3 Forwarding** ✅ — `POST /messages/:id/forward` (a varias conversaciones),
  copia body y referencia los mismos adjuntos sin re-subir; `getAttachmentObjects`
  ahora solo borra de MinIO objetos no compartidos (evita romper el original).
  UI: botón "Reenviar" en la toolbar + `ForwardModal` para elegir destinos.
- **6.4 Polls** ✅ — módulo `polls` (`poll.repository/service/controller/routes/model`)
  en `/api/polls`: crear (mensaje tipo `poll` + opciones), votar (single/multiple),
  quitar voto y cerrar; recuento desnormalizado y evento realtime `poll:update`.
  Los mensajes tipo poll se enriquecen con la encuesta al cargar. UI: `PollMessage`
  (barras de resultados + votación) y `CreatePollModal` desde el composer. i18n es/en/pt.
- **6.5 Threads** ✅ — backend: `GET /messages/:id/thread` (raíz + respuestas ordenadas),
  validación de `thread_id` al enviar (debe apuntar a una raíz de la misma conversación;
  responder a una respuesta se aplana sobre la raíz, estilo Slack), las respuestas de hilo
  se excluyen del timeline principal y cada mensaje expone `thread_count`; evento realtime
  `message:thread_count` para refrescar el contador sin refetch. Frontend: acción
  "Responder en hilo" en el menú contextual, badge "N respuestas" en la burbuja y
  `ThreadPanel` lateral (raíz + respuestas en vivo + composer propio), exclusión mutua
  con el panel de búsqueda. i18n es/en/pt.

## FASE 7 — Panel de administración

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 7.1 | Gestión de usuarios (alta/baja/suspensión, roles). | M (3-4d) | 0.1 | ✅ |
| 7.2 | Editor de `system_settings`. | S (2d) | 0.1 | ✅ |
| 7.3 | Visor de audit log con filtros. | S (2d) | 0.2 | ✅ |
| 7.4 | Dashboard de storage MinIO. | M (2-3d) | 0.1 | ✅ base |

### Detalle de lo implementado en Fase 7

- **Módulo `/api/admin`** con RBAC (`admin.users`, `admin.settings`,
  `admin.view_audit`, `admin.storage`): `admin.service/controller/routes`,
  repos extendidos (`user`, `audit`, `storage`) + `systemSettings.repository`.
- **7.1 Usuarios** ✅ — listar/filtrar, crear con contraseña y roles, editar
  perfil/estado/roles, soft-delete; revoca sesiones al suspender; protege último
  `super_admin`; audit `admin.user_*`.
- **7.2 Settings** ✅ — `GET/PUT /api/admin/settings/:key` con audit
  `admin.setting_update`; editor por categoría en UI.
- **7.3 Audit** ✅ — `GET /api/admin/audit` con filtros (acción, actor, éxito);
  tabla con actor enriquecido.
- **7.4 Storage** ✅ base — stats agregados (total bytes, por bucket/tipo,
  pendientes/fallidos) + listado de objetos recientes desde `storage_objects`.
- **Frontend** — `AdminPage` (`/admin/:section`) con tabs usuarios/sistema/
  auditoría/almacenamiento; entrada en dock y Command Palette solo si el usuario
  tiene permisos admin; `/auth/me` expone `roles` y `permissions`; i18n es/en/pt.

---

## FASE 8 — Formato enriquecido y contenido del mensaje

> Objetivo: cerrar la brecha entre lo que el schema/DTO ya permiten (`body_format`,
> `link_preview`, tipos `location`/`contact`, preferencia `message.mention`) y lo que
> el usuario ve al escribir y leer. Incluye **markdown**, **formato inline** (negrita,
> cursiva, tachado), **bloques de código**, menciones, previews, tipos especiales y
> dos pendientes transversales (retención + métricas de broadcast).

### Estado de avance Fase 8

| Bloque | Tema | Estado |
|--------|------|--------|
| 8.A | Motor de renderizado + composer rico | 🟡 En progreso (8.1–8.3 ✅) |
| 8.B | Menciones y enlaces enriquecidos | ⬜ |
| 8.C | Tipos de mensaje especiales | ⬜ |
| 8.D | Jobs y métricas pendientes | ⬜ |

Orden recomendado dentro de la fase:
```
8.1 → 8.2 → 8.3 → (8.4 en paralelo con 8.2) → 8.5 → 8.6 → 8.7 → 8.8 → 8.9
```

### Resumen de tareas

| # | Funcionalidad | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|
| 8.1 | **Renderizado Markdown** en burbujas (`body_format: markdown`). | S (1-2d) | — | ✅ |
| 8.2 | **Barra de formato inline** en el composer: negrita, cursiva, tachado, código inline. | S (2d) | 8.1 | ✅ |
| 8.3 | **Bloques de código**: mensaje tipo código + syntax highlight + copiar. | M (2-3d) | 8.1 | ✅ |
| 8.4 | **@Menciones**: autocompletado, resaltado, notificación `message.mention`. | S (2d) | 8.1 | ✅ |
| 8.5 | **Preview de links** (job async → `link_preview` JSONB). | S–M (2d) | 0.3, 8.1 | ⬜ |
| 8.6 | **Mensajes de ubicación** (tipo `location` + mapa estático). | S (1-2d) | — | ⬜ |
| 8.7 | **Mensajes de contacto** (tipo `contact` + tarjeta vCard). | S (1-2d) | — | ⬜ |
| 8.8 | **Retención de mensajes** (`message_retention_days` + job). | S (1-2d) | 0.3 | ⬜ |
| 8.9 | **Sincronizar `total_read`** en broadcasts desde read receipts. | S (1d) | 3.3 | ⬜ |

### Detalle de lo implementado en Fase 8 (parcial)

- **8.1 Renderizado Markdown** ✅ — `MessageBody` (`react-markdown` + `remark-gfm`): plain vs
  markdown según `body_format`; estilos para negrita, cursiva, tachado, código inline, bloques,
  listas, blockquote y links seguros. Integrado en `ConversationPage`, `ThreadPanel` y
  `SavedMessagesPage`. Detección automática en envío/edición vía `detectBodyFormat` /
  `backend/src/utils/markdown.util.js`.
- **8.2 Barra de formato** ✅ — `FormatToolbar` en composer principal y panel de hilos: botones
  negrita/cursiva/tachado/código inline; atajos Ctrl+B / Ctrl+I / Ctrl+E; textarea multilínea
  (Enter envía, Shift+Enter nueva línea). i18n es/en/pt.
- **8.4 @Menciones** ✅ — el backend resuelve el texto contra los miembros reales de la
  conversación (`utils/mentions.util.ts`; lo que mande el cliente en `metadata.mentions` se
  descarta) y guarda `{user_id, label, offset, length}` en `metadata`. Notificación in-app tipo
  `mention` respetando `notification_preferences` y horario de silencio (`notificationService
  .shouldNotifyInApp`), + socket `notification:new`. La notificación **no** guarda un extracto del
  mensaje: `notifications.body` es texto plano y el contenido va cifrado en reposo. Frontend:
  autocompletado en el composer (`MentionAutocomplete`), resaltado en `MessageBody` (plano y
  markdown, vía plugin remark), toast al ser mencionado. i18n es/en/pt.
- **8.3 Bloques de código** ✅ — tipo `code` en BD (migración `005_add_message_type_code.sql`);
  DTO/service con `metadata.language` y límite 20k chars; `CodeMessage` con syntax highlight
  (`react-syntax-highlighter`) y botón copiar; `CreateCodeModal` desde menú adjuntar; detección
  al pegar bloques ` ```lang `; integrado en conversación, hilos y guardados. i18n es/en/pt.

---

### Bloque 8.A — Motor de renderizado y composer rico

#### 8.1 Renderizado Markdown en burbujas

**Estado actual:** `body_format` acepta `plain | markdown | html` en DTO y BD; el frontend
muestra `body` como texto plano.

**Entregables:**
- Componente `MessageBody` que según `body_format` renderice:
  - `plain` → texto escapado (comportamiento actual).
  - `markdown` → parser seguro (p. ej. `react-markdown` + `remark-gfm`; **sin** HTML crudo).
  - `html` → reservado/futuro; rechazar en envío hasta tener sanitización (`DOMPurify`).
- Estilos en burbujas: párrafos, listas, blockquote, enlaces externos (`target="_blank"`,
  `rel="noopener noreferrer"`).
- Aplicar en `ConversationPage`, `ThreadPanel`, `SavedMessagesPage`, previews de reenvío.
- Al enviar texto normal desde el composer, persistir `body_format: 'markdown'` si contiene
  sintaxis markdown; si no, `plain` (retrocompatible).

**Archivos clave:** `frontend/src/components/MessageBody.jsx`, burbujas en `ConversationPage.jsx`.

---

#### 8.2 Barra de formato inline (negrita, cursiva, tachado, código inline)

**Sintaxis objetivo (estilo Slack/Discord):**

| Acción | Markdown | Atajo (opcional) |
|--------|----------|------------------|
| Negrita | `**texto**` | Ctrl+B |
| Cursiva | `*texto*` | Ctrl+I |
| Tachado | `~~texto~~` | — |
| Código inline | `` `código` `` | Ctrl+E |

**Entregables:**
- Toolbar sobre el composer (`FormatToolbar`): botones Bold / Italic / Strikethrough / Code.
- Insertar o envolver la selección actual del `<textarea>` con los delimitadores markdown.
- Preview en vivo opcional (toggle) reutilizando `MessageBody`.
- i18n es/en/pt + tooltips de atajos.
- Edición de mensajes: conservar `body_format` al editar.

**Depende de 8.1** para que el usuario vea el resultado formateado en la burbuja.

---

#### 8.3 Bloques de código (mensaje dedicado)

**Objetivo:** poder enviar un snippet completo como mensaje de código (no solo inline),
con resaltado de sintaxis y botón copiar — útil para IT, devs y soporte.

**Modelo de datos (recomendado):**

```sql
-- Migración: ampliar CHECK de messages.type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text','media','location','contact','system','poll',
                  'forwarded','deleted_placeholder','code'));
```

- Tipo `code` con `body` = contenido del snippet (sin fences).
- `metadata`: `{ "language": "javascript" | "sql" | "plaintext" | ... }`.
- Alternativa sin migración: mensaje `text` + `metadata.code_block: true`; la UI trata
  el caso igual. **Preferir tipo `code`** para filtros, búsqueda y render dedicado.

**Entregables backend:**
- Ampliar `sendMessageDto.type` con `'code'`.
- Validación: `body` requerido, max 20 000 chars para snippets largos.
- `body_format` ignorado o forzado a `plain` en tipo `code`.

**Entregables frontend:**
- Modo **“Enviar como código”** en el composer: textarea monoespaciado + selector de lenguaje.
- Burbuja `CodeMessage`: fondo oscuro/claro según tema, `react-syntax-highlighter` (o
  `shiki` ligero), botón **Copiar** con feedback toast.
- Atajo: pegar bloque con triple backtick detectado → sugerir modo código.
- i18n es/en/pt.

**Archivos clave:** `CodeMessage.jsx`, composer en `ConversationPage.jsx`,
`message.dto.js`, migración SQL.

---

### Bloque 8.B — Menciones y enlaces enriquecidos

#### 8.4 @Menciones

**Estado actual:** preferencia `message.mention` en UI de notificaciones; sin parseo ni envío.

**Formato de almacenamiento (recomendado):**
- Texto visible: `@María García` o mención corta `@maria.garcia`.
- `metadata.mentions`: `[{ "user_id": "uuid", "offset": 0, "length": 12 }]`
  para resaltado preciso y notificaciones sin re-parsear.

**Entregables backend:**
- Al enviar: detectar `@display_name` o token `<@uuid>`; validar que el usuario es miembro
  de la conversación; persistir en `metadata.mentions`.
- Notificación in-app tipo `mention` respetando `notification_preferences`.
- Socket `notification:new` al mencionado.
- Endpoint auxiliar opcional: `GET /conversations/:id/members/search?q=` (o reutilizar
  miembros cargados en cliente).

**Entregables frontend:**
- Autocompletado `@` en composer (lista de miembros filtrable).
- Resaltado en `MessageBody`: clase `mention` con color accent + click → perfil/DM.
- Badge “te mencionaron” en lista de conversaciones (opcional, S+).

---

#### 8.5 Preview de links

**Estado actual:** columna `link_preview JSONB` en `messages`; sin población.

**Entregables backend:**
- Tras `sendMessage`, si el body contiene URL HTTP(S), encolar job `link-preview-fetch`.
- Job: GET con timeout, parse Open Graph / `<title>` / `<meta description>` / imagen;
  guardar `{ url, title, description, image_url, site_name }` en `link_preview`.
- Emitir socket `message:link_preview` para actualizar la burbuja sin recargar.
- Límites: SSRF guard (solo URLs públicas, bloquear IPs privadas), cache 24 h por URL.
- No fetch si el mensaje es solo un adjunto o tipo `code`.

**Entregables frontend:**
- Componente `LinkPreviewCard` bajo el texto del mensaje (imagen + título + dominio).
- Skeleton mientras `link_preview` es null y hay URL detectada.

**Depende de 0.3** (infra jobs) y **8.1** (URLs dentro de markdown renderizado).

---

### Bloque 8.C — Tipos de mensaje especiales

#### 8.6 Mensajes de ubicación

**Estado actual:** tipo `location` en DTO; sin UI.

**Entregables:**
- Composer: botón “Ubicación” → modal con mapa (Leaflet o Mapbox) o “Usar mi ubicación”
  (`navigator.geolocation`).
- `metadata`: `{ "lat": number, "lng": number, "label": string? }`.
- Burbuja: mini-mapa estático (tile provider) + enlace a Google/OSM maps.
- Permiso denegado: mensaje de error i18n.

**Esfuerzo:** S (1-2d).

---

#### 8.7 Mensajes de contacto

**Estado actual:** tipo `contact` en DTO; módulo `relationships` y `ContactsPage` existen.

**Entregables:**
- Composer: “Compartir contacto” → picker de contactos EchoChat o usuario de la org.
- `metadata`: `{ "user_id": "uuid" }` (referencia interna; no duplicar PII).
- Burbuja `ContactCard`: avatar, nombre, departamento, botones “Ver perfil” / “Mensaje”.
- Reutilizar datos de `GET /users/:id` o miembros en cache.

**Esfuerzo:** S (1-2d).

---

### Bloque 8.D — Jobs y métricas pendientes

#### 8.8 Retención de mensajes

**Estado actual:** `system_settings.message_retention_days` (0 = sin límite); comentario
pendiente en `backend/src/jobs/index.js`.

**Entregables:**
- Job `message-retention` (diario): leer setting; soft-delete (`is_deleted`) mensajes
  con `sent_at` anterior al umbral.
- Opcional: hard-delete adjuntos huérfanos vía job existente de storage.
- Audit `message.retention_purge` con conteo.
- Documentar en Admin → Sistema el efecto del setting.

**Depende de 0.3.**

---

#### 8.9 Sincronizar `total_read` en broadcasts

**Estado actual:** Fase 3.3 registra entregas; `total_read` no se actualiza desde read receipts.

**Entregables:**
- Al marcar conversación/DM de broadcast como leída, incrementar contador en
  `broadcast_deliveries` y denormalizado `broadcast_messages.total_read`.
- UI en `BroadcastsPage`: barra entregado/leído coherente con datos reales.
- Idempotente: un recipient solo cuenta una vez.

**Depende de 3.3** (tracking base).

---

### Criterios de aceptación (Fase 8 completa)

- [ ] Escribir `**hola**` y ver **hola** en negrita; `~~x~~` tachado; `` `fn()` `` inline.
- [ ] Enviar mensaje tipo código con lenguaje JS/Python y copiar al portapapeles.
- [ ] `@usuario` notifica al mencionado si tiene preferencia activa.
- [ ] URL en mensaje muestra tarjeta preview tras unos segundos.
- [ ] Compartir ubicación y contacto desde el composer.
- [ ] Con `message_retention_days = 90`, mensajes antiguos se soft-eliminan en job nocturno.
- [ ] Métricas de broadcast reflejan lecturas reales.

### Dependencias npm sugeridas (frontend)

| Paquete | Uso |
|---------|-----|
| `react-markdown` + `remark-gfm` | Render markdown seguro |
| `react-syntax-highlighter` | Highlight bloques de código |
| `leaflet` / `react-leaflet` | Selector de ubicación (opcional) |

### Notas de seguridad

- **No** habilitar `body_format: html` hasta sanitizar con allowlist estricta.
- Link preview job: protección SSRF obligatoria.
- Menciones: solo miembros de la conversación; ignorar `@` en bloques de código.
- Markdown: desactivar HTML embebido en el parser (`skipHtml` / sin `rehype-raw`).

---

## FASE 9 — Ausencias y agenda

> No estaba en el plan original: salieron de revisar qué le falta a la app para uso real de
> intranet. Las dos reusan infraestructura que ya existía (presencia y jobs).

| # | Funcionalidad | Estado |
|---|---|---|
| 9.1 | **Estado de ausencia con auto-respuesta** | ✅ |
| 9.2 | **Mensajes programados y recordatorios** | ✅ |
| 9.3 | **Resync del timeline al reconectar el socket** | ✅ |

### Detalle

- **9.1 Ausencia** — migración `017`: `users.away_until`, `users.auto_reply_enabled` (el texto
  visible sigue siendo `presence_message`, que ya existía) + tabla `auto_reply_log`.
  `PUT/DELETE /api/users/me/away`, tab Estado en Ajustes, mensaje de ausencia del otro lado en el
  header del chat. En chats directos, la auto-respuesta sale una vez cada 4 h por interlocutor
  (reserva atómica en `auto_reply_log`) y nunca responde a otra auto-respuesta. Job `away-expiry`
  (cada 5 min) limpia las ausencias vencidas.
- **9.2 Programados y recordatorios** — migración `018`: `scheduled_messages` y
  `message_reminders` (el body va cifrado igual que `messages.body`). Módulo `/api/scheduled`
  (6 endpoints) + job `scheduled-messages` (cada minuto) que despacha por `messageService.send`,
  así que un programado hereda menciones, acuses y tiempo real. UI: "Programar mensaje" en el
  menú del composer y "Recordarme" en el menú contextual del mensaje.
- **9.3 Resync** — `chatStore.resyncAfterReconnect()`: al volver el socket se refresca la lista y
  se reconcilia el timeline abierto (fusiona ediciones/borrados, agrega lo que llegó durante el
  corte y, si el hueco es mayor a una página, habilita el scroll hacia arriba). Antes, todo lo
  recibido mientras el socket estaba caído quedaba invisible hasta un F5.
