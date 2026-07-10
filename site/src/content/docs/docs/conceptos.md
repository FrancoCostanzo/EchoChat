---
title: Conceptos
description: Glosario de términos y modelos de EchoChat para entender la plataforma.
---

Todo en EchoChat gira alrededor de la **conversación**. Este glosario define las entidades
principales y cómo se relacionan entre sí.

## Tipos de conversación

Toda charla —directa, grupal, canal o difusión— se guarda como una fila en la tabla
`conversations`, con un `type` que la distingue:

| Tipo | Descripción |
|------|-------------|
| `direct` | Chat 1:1 entre dos usuarios |
| `group` | Grupo privado con varios miembros |
| `channel` | Canal con categoría, modo de acceso y opcionalmente descubrible (ver [Canales](/docs/uso/canales)) |
| `broadcast` | Lista de difusión: el remitente envía a muchos destinatarios sin que se vean entre sí (ver [Difusiones](/docs/uso/difusiones)) |

Cada conversación tiene miembros (`conversation_members`) con su propio rol, estado de
lectura (`last_read_at`) y flags como silenciado/fijado/archivado.

## Roles y permisos

EchoChat combina dos niveles de control de acceso:

- **RBAC global**: cada usuario tiene uno o más `roles` (p. ej. `super_admin`, `admin`,
  `member`), y cada rol agrupa `permissions` (p. ej. `admin.users`, `broadcast.send`,
  `media.upload`). El rol `super_admin` evita todas las verificaciones de permisos.
- **Roles por conversación**: dentro de un grupo o canal, un miembro puede ser `owner`,
  `admin`, `moderador`, `miembro` o `viewer` — independiente de su rol global.

Ver [RBAC](/docs/admin/rbac) para el detalle administrativo.

## Presencia

Cada usuario tiene un estado de presencia en tiempo real, propagado por Socket.IO
(evento `presence:changed`):

| Estado | Significado |
|--------|-------------|
| `online` | Conectado y activo |
| `away` | Conectado pero inactivo (pasa automáticamente tras un tiempo configurable) |
| `busy` | Ocupado, marcado manualmente |
| `dnd` | No molestar |
| `offline` | Desconectado |

Un job en el backend (`presence-timeout`, cada minuto) pasa a `away` a los usuarios
`online` inactivos, según `system_settings.presence_timeout_minutes`.

## Mensajes y recibos

Un **mensaje** (`messages`) pertenece a una conversación y tiene un `type`: `text`,
`media`, `code`, `poll`, `forwarded`, `system`, entre otros. Cada mensaje puede tener:

- **Ediciones** con historial (`message_edits`).
- **Reacciones** con emoji (`message_reactions`).
- **Recibos** de entrega y lectura por destinatario (`message_receipts`), que alimentan
  el doble check visual.
- **Adjuntos** vinculados a objetos de MinIO (`message_attachments`).

## Hilos (threads)

Una respuesta puede citar un mensaje raíz y quedar agrupada como **hilo** (`thread_id`).
Las respuestas de hilo no aparecen en la línea de tiempo principal; el mensaje raíz
muestra un contador de respuestas que se actualiza en vivo.

## Canales

Un **canal** es una conversación de tipo `channel` con configuración extendida
(`channel_settings`): categoría (anuncios, departamento, proyecto, general), si es
oficial, si es descubrible y su modo de acceso (`open`, `invite_only`, `request`). Los
canales con modo `request` generan **solicitudes de ingreso** (`channel_join_requests`)
que un owner/admin del canal aprueba o rechaza.

## Difusiones

Una **lista de difusión** (`broadcast_lists`) agrupa destinatarios (`broadcast_recipients`)
que reciben cada `broadcast_messages` como un mensaje directo individual — nunca se ven
entre sí. El envío puede ser inmediato o programado (`scheduled_at`), y el seguimiento de
entrega/lectura se registra por destinatario en `broadcast_deliveries`.

## Notificaciones

Cada evento relevante (mensaje directo, mención, solicitud de canal, difusión, llamada
entrante) genera una fila en `notifications`. Qué canales recibe el usuario — in-app,
push, email — se define por tipo de evento en `notification_preferences`, junto con un
horario de silencio opcional.

## Almacenamiento de archivos

Los archivos (avatares, imágenes, videos, audio, documentos, grabaciones) se suben a
**MinIO** y se referencian en `storage_objects`. La descarga desde el navegador usa
**URLs prefirmadas** con expiración (`storage_presigned_urls`), cacheadas y limpiadas
periódicamente por un job. Ver [Almacenamiento](/docs/despliegue/almacenamiento).

## Llamadas WebRTC

Las llamadas de voz/video son **peer-to-peer sobre WebRTC**, con el backend actuando
solo como servidor de señalización vía Socket.IO (rooms `call:{callId}`). Cada llamada
(`calls`) tiene participantes (`call_participants`) con su propio estado, y opcionalmente
una grabación con consentimiento (`call_recordings`).
