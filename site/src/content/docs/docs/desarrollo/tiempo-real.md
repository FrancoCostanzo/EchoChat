---
title: Tiempo real
description: Eventos Socket.IO, rooms y autenticación de conexiones.
---

## Arquitectura Socket.IO

Todo lo que ocurre en tiempo real (mensajes, tipeo, presencia, recibos, señalización de
llamadas, actualizaciones de encuestas, notificaciones) viaja por **Socket.IO** sobre el
mismo servidor HTTP que expone la API REST. La inicialización vive en
`backend/src/socket.ts`, arrancada desde `server.ts`.

## Autenticación JWT en sockets

El middleware `io.use(...)` lee el JWT de `socket.handshake.auth.token`, lo valida contra
el mismo servicio de auth que usa la API REST, y adjunta `socket.userId`/`socket.user`.
Sin token válido, la conexión se rechaza con `Authentication required` o `Invalid token`.

```typescript
import { connectSocket } from '@/lib/socket';
const socket = connectSocket(token); // token JWT del login
```

## Rooms y salas

Al conectar, cada socket se une automáticamente a:

| Room | Cuándo |
|------|--------|
| `user:{userId}` | Siempre — eventos dirigidos al usuario (notificaciones, llamadas entrantes) |
| `conv:{conversationId}` | Por cada conversación de la que el usuario es miembro |
| `call:{callId}` | Al iniciar o aceptar una llamada |

## Eventos server → client

**Mensajería** (room `conv:{id}`):

| Evento | Payload | Descripción |
|--------|---------|--------------|
| `message:new` | objeto mensaje | Nuevo mensaje (incluye difusiones, encuestas y avisos de llamada) |
| `message:edited` | objeto mensaje | Mensaje editado |
| `message:deleted` | objeto mensaje | Soft delete: el mensaje queda como placeholder (`is_deleted`) |
| `message:reaction` | `{ messageId, reactions[] }` | Reacción agregada/quitada |
| `message:receipt` | `{ messageId, conversationId, delivered_count, read_count }` | Recibo de entrega/lectura |
| `message:thread_count` | `{ messageId, thread_count }` | Contador de respuestas de un hilo |
| `typing:start` | `{ conversationId, userId, displayName }` | Empezó a escribir |
| `typing:stop` | `{ conversationId, userId }` | Dejó de escribir |
| `messages:read` | `{ conversationId, userId, countsMap }` | Mensajes marcados como leídos |
| `poll:update` | `{ conversationId, messageId, poll }` | Voto nuevo o cierre de encuesta |

**Dirigidos al usuario** (room `user:{id}`):

| Evento | Payload | Descripción |
|--------|---------|--------------|
| `presence:changed` | `{ userId, presence }` | Cambio de presencia — se emite **global** (`io.emit`), lo recibe todo socket conectado |
| `notification:new` | objeto notificación (`{ type, ... }`) | Notificación nueva (p. ej. difusión) |
| `channel:joined` | `{ conversationId }` | Se aprobó tu solicitud de ingreso a un canal |
| `channel:join_request` | `{ conversationId }` | Nueva solicitud pendiente (para el gestor del canal) |

**Llamadas** (señalización WebRTC):

| Evento | Room | Payload | Descripción |
|--------|------|---------|--------------|
| `call:incoming` | `user:{calleeId}` | `{ callId, conversationId, type, from, participantIds[] }` | Llamada entrante |
| `call:peers` | socket que acepta | `{ callId, userIds[] }` | Quiénes ya están en la llamada (para armar la malla) |
| `call:peer-joined` | `call:{id}` | `{ callId, userId }` | Un par se unió |
| `call:peer-left` | `call:{id}` | `{ callId, userId }` | Un par se fue (o se desconectó) |
| `call:rejected` | `call:{id}` | `{ callId, userId, reason }` | Un invitado rechazó |
| `call:cancelled` | `call:{id}` y `user:{id}` | `{ callId }` | El que llamaba canceló antes de contestar |
| `call:signal` | `user:{to}` | `{ callId, from, data }` | Relé de señalización SDP/ICE |
| `call:media` | `call:{id}` | `{ callId, userId, kind, enabled }` | Cambio de micrófono/cámara |

## Eventos client → server

| Evento | Payload | Descripción |
|--------|---------|--------------|
| `join:conversation` | `conversationId` | Unirse a la room de una conversación recién creada/abierta |
| `presence:active` | *(sin payload)* | Heartbeat de actividad (throttled): refresca `last_seen_at` y restaura `online` si el job lo había pasado a `away` |
| `typing:start` / `typing:stop` | `{ conversationId }` | Indicador de escritura |
| `messages:read` | `{ conversationId, messageIds[] }` | Marcar mensajes como leídos |
| `messages:delivered` | `{ conversationId, messageIds[] }` | Marcar mensajes como entregados |
| `call:start` | `{ callId, conversationId, type, calleeIds[], from }` | Iniciar una llamada (timbra a los invitados) |
| `call:accept` / `call:reject` / `call:cancel` / `call:leave` | `{ callId, ... }` | Ciclo de vida de la llamada |
| `call:signal` | `{ callId, to, data }` | Señalización dirigida a un par |
| `call:media` | `{ callId, kind, enabled }` | Silenciar micro / apagar cámara / compartir |

## Presencia y typing

La presencia (`online`/`away`/`busy`/`dnd`/`offline`) se propaga globalmente vía
`presence:changed`. Un socket desconectado tiene un **grace period de 2.5 segundos**
antes de marcarse `offline`, para tolerar reconexiones breves (cambio de red, recarga de
pestaña). El job `presence-timeout` (cada minuto) pasa a `away` a los usuarios `online`
inactivos según `system_settings.presence_timeout_minutes`.

## Llamadas y señalización

El servidor **solo transporta señalización** para llamadas WebRTC — nunca ve el audio ni
el video. Cada llamada usa la room `call:{callId}` para reenviar ofertas/respuestas SDP y
candidatos ICE entre los participantes (`call:signal`). Ver el detalle completo en
[Llamadas de voz y video](/docs/llamadas) y [Red y TURN](/docs/despliegue/red-y-turn).

## Encuestas y notificaciones

Los votos de encuesta se persisten vía REST (`/api/polls/:id/vote`) y el resultado
recalculado se emite por `poll:update` a la room de la conversación. Las notificaciones
in-app (nuevas difusiones, solicitudes de canal) llegan por `notification:new` a la room
personal `user:{id}`, independientemente de si el destinatario tiene esa conversación
abierta.

## Buenas prácticas

- Los servicios cargan Socket.IO de forma **lazy** (`require` diferido) para evitar
  dependencias circulares con las rutas HTTP.
- Nomenclatura de eventos: `recurso:acción` (`message:new`, `typing:start`).
- Nunca emitir datos sensibles (tokens, contraseñas) por un evento de socket.
- Si agregás un evento nuevo, documentalo en esta página y en el frontend
  (`lib/socket.ts` + el store que lo consume).
