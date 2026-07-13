---
title: Notificaciones
description: Preferencias de notificación, horarios de silencio y badges.
---

## Notificaciones in-app

Todas las notificaciones (mensajes directos, menciones, solicitudes de canal, difusiones,
llamadas entrantes) aparecen en tiempo real en la bandeja de notificaciones (`/notifications`)
sin necesidad de recargar la página.

## Preferencias por evento

Desde **Configuración → Notificaciones** podés activar o desactivar, por cada tipo de
evento, qué canales de notificación recibís:

| Evento | Descripción |
|--------|-------------|
| `message.direct` | Mensaje directo nuevo |
| `message.group` | Mensaje nuevo en un grupo |
| `message.mention` | Te mencionaron en un mensaje |
| `channel.join_request` | Solicitud de ingreso a un canal que moderás |
| `broadcast` | Nueva difusión recibida |
| `call.incoming` | Llamada entrante |

## Push y email

Cada evento se puede recibir por **in-app**, **push** o **email**, de forma
independiente. El envío real de notificaciones push (Web Push) y por email está
planificado pero **aún no implementado** — los interruptores se guardan pero todavía no
disparan un envío (ver [Estado del proyecto](/docs/estado)); mientras tanto, las
notificaciones in-app funcionan por completo.

## Horarios de silencio

Podés configurar un horario global de silencio (por ejemplo, de noche o fuera de horario
laboral) durante el cual no se generan notificaciones activas, sin afectar la bandeja
in-app que sigue registrándolas para cuando vuelvas a mirar.

## Contador de no leídas

El ícono de notificaciones en el dock muestra un contador (badge) con la cantidad de
notificaciones no leídas.

## Marcar todo como leído

Desde la bandeja de notificaciones podés marcar una notificación individual como leída,
o usar la acción **Marcar todo como leído** para limpiar el contador de una sola vez.

## Menciones

Mencionar a alguien en un mensaje (ver [Fase 8 del roadmap](/docs/estado)) generará una
notificación de tipo `message.mention`; hoy esta función de mención con autocompletado
todavía está en desarrollo.
