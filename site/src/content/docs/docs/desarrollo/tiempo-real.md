---
title: Tiempo real
description: Eventos Socket.IO, rooms y autenticación de conexiones.
---

## Arquitectura Socket.IO

Todo lo que ocurre en tiempo real (mensajes, tipeo, presencia, recibos, señalización de
llamadas, actualizaciones de encuestas, notificaciones) viaja por **Socket.IO** sobre el
mismo servidor HTTP que expone la API REST. La inicialización vive en
`backend/src/socket.js`, arrancada desde `server.js`.

## Autenticación JWT en sockets

El middleware `io.use(...)` lee el JWT de `socket.handshake.auth.token`, lo valida contra
el mismo servicio de auth que usa la API REST, y adjunta `socket.userId`/`socket.user`.
Sin token válido, la conexión se rechaza con `Authentication required` o `Invalid token`.

```javascript
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

| Evento | Room / alcance | Descripción |
|--------|-----------------|--------------|
| `message:new` | `conv:{id}` | Nuevo mensaje (incluye difusiones y encuestas) |
| `message:edited` | `conv:{id}` | Mensaje editado |
| `message:deleted` | `conv:{id}` | Mensaje eliminado |
| `message:reaction` | `conv:{id}` | Reacción agregada/quitada |
| `message:receipt` | `conv:{id}` | Recibo de entrega/lectura |
| `message:thread_count` | `conv:{id}` | Contador de respuestas de un hilo actualizado |
| `typing:start` / `typing:stop` | `conv:{id}` | Indicador de escritura |
| `messages:read` | `conv:{id}` | Mensajes marcados como leídos |
| `presence:changed` | Global | Cambio de presencia de un usuario |
| `poll:update` | `conv:{id}` | Voto nuevo o cierre de encuesta |
| `notification:new` | `user:{id}` | Notificación nueva (p. ej. difusión) |
| `channel:joined` | `user:{id}` | Se aprobó tu solicitud de ingreso a un canal |
| `channel:join_request` | `user:{managerId}` | Nueva solicitud pendiente para un gestor |
| `call:incoming` | `user:{calleeId}` | Llamada entrante |
| `call:peers` / `call:peer-joined` / `call:peer-left` | `call:{id}` | Gestión de participantes |
| `call:rejected` / `call:cancelled` | `call:{id}` / `user:{id}` | Llamada rechazada o cancelada |
| `call:signal` | `user:{to}` | Relé de señalización SDP/ICE |
| `call:media` | `call:{id}` | Cambio de estado de micrófono/cámara |

## Eventos client → server

| Evento | Payload |
|--------|---------|
| `join:conversation` | `conversationId` |
| `typing:start` / `typing:stop` | `{ conversationId }` |
| `messages:read` | `{ conversationId, messageIds[] }` |
| `messages:delivered` | `{ conversationId, messageIds[] }` |
| `call:start` | `{ callId, conversationId, type, calleeIds[], from }` |
| `call:accept` / `call:reject` / `call:cancel` / `call:leave` | `{ callId, ... }` |
| `call:signal` | `{ callId, to, data }` |
| `call:media` | `{ callId, kind, enabled }` |

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
  (`lib/socket.js` + el store que lo consume).
