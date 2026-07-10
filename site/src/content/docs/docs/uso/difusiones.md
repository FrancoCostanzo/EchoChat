---
title: Difusiones
description: Listas de difusión, envío programado y seguimiento de entrega.
---

## Qué es una difusión

Una difusión (broadcast) te permite enviar el mismo mensaje a muchas personas a la vez,
donde cada destinatario lo recibe como si fuera un mensaje directo — sin que se enteren
de quiénes son los demás destinatarios. Ideal para avisos institucionales o de área.

## Crear listas de difusión

Desde **Difusiones** (`/broadcasts`), creá una lista nueva con un nombre descriptivo.
Crear listas y enviar difusiones requiere el permiso `broadcast.create` (ver
[RBAC](/docs/admin/rbac)).

## Gestionar destinatarios

Agregá destinatarios a una lista de forma individual o por **departamento completo**.
También podés quitar destinatarios en cualquier momento; los cambios afectan a los
próximos envíos de esa lista.

## Redactar y enviar

Redactá el mensaje de la difusión igual que un mensaje normal (texto, formato, adjuntos)
y elegí enviarlo de inmediato. Enviar requiere el permiso `broadcast.send`.

## Envío programado

En lugar de enviar ya, podés programar una fecha y hora futura. Un job en el backend
revisa cada minuto las difusiones programadas vencidas y las despacha automáticamente.

## Métricas de entrega y lectura

Cada difusión enviada muestra métricas agregadas: total de destinatarios, cuántos la
recibieron y cuántos la leyeron, visibles en el historial de la lista.

## Privacidad entre receptores

Los destinatarios de una difusión **nunca se ven entre sí** ni saben que forman parte de
la misma lista: cada uno recibe el mensaje como una conversación directa individual con
el remitente.
