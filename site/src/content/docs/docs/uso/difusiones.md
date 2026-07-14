---
title: Difusiones
description: Listas de difusión, envío programado y seguimiento de entrega.
---

## Qué es una difusión

Una difusión (broadcast) te permite enviar el mismo mensaje a muchas personas a la vez,
donde cada destinatario lo recibe como si fuera un mensaje directo — sin que se enteren
de quiénes son los demás destinatarios. Ideal para avisos institucionales o de área.

## Crear listas de difusión

Desde **Difusiones** (`/broadcasts`), creá una lista nueva con un nombre descriptivo y
elegí destinatarios con el mismo selector de contactos que en un chat nuevo (incluye
fotos de perfil). Crear listas y enviar difusiones requiere el permiso `broadcast.create`
(ver [RBAC](/docs/admin/rbac)).

## Gestionar destinatarios

Agregá destinatarios a una lista de forma individual o por **departamento completo**.
También podés quitar destinatarios en cualquier momento; los cambios afectan a los
próximos envíos de esa lista.

## Redactar y enviar

Redactá el mensaje de la difusión y elegí enviarlo de inmediato, o programá fecha y
hora. Enviar requiere el permiso `broadcast.send`. El flujo es una vista integrada en la
página (sin modales): lista → crear / detalle → historial.

## Envío programado

En lugar de enviar ya, podés programar una fecha y hora futura. Un job en el backend
revisa cada minuto las difusiones programadas vencidas y las despacha automáticamente.

## Cómo llega al destinatario

Cada envío crea (o reutiliza) un mensaje directo con el destinatario. El DM lleva
metadata de origen (`broadcast_msg_id`, `broadcast_list_id`, nombre de la lista) y se
emite en tiempo real también a la sala personal del usuario, para que lo vea aunque no
tuviera ese chat abierto todavía.

En el chat del destinatario (y del remitente) el mensaje se marca con un sello **Difusión**
(o **Difusión · nombre de la lista**). En la lista de conversaciones, el preview del
último mensaje también muestra el ícono de megáfono cuando corresponde.

## Métricas de entrega y lectura

El historial de cada lista muestra, por mensaje enviado:

| Estado | Significado |
|--------|-------------|
| **Enviados** | Fan-out exitoso: el DM se creó en la conversación |
| **Recibidos** | El cliente del destinatario acusó recibo (`message_receipts.delivered_at`) |
| **Leídos** | El destinatario abrió/leyó el mensaje (`message_receipts.read_at`) |
| **Fallidos** | No se pudo crear el DM para ese destinatario |

Expandí un envío del historial para ver el detalle por persona (enviado al chat /
recibido / leído) con fotos de perfil. Los contadores de recibido/leído se actualizan
cuando llegan los recibos normales del chat.

## Privacidad entre receptores

Los destinatarios de una difusión **nunca se ven entre sí** ni saben quién más está en
la misma lista: cada uno recibe el mensaje como una conversación directa individual con
el remitente. Lo que sí ven es que ese DM proviene de una difusión (sello en el
mensaje).
