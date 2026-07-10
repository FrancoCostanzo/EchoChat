---
title: Estado del proyecto
description: Estado actual de EchoChat, funciones listas y roadmap resumido.
---

EchoChat está en **desarrollo activo**. Esta página resume qué funciona hoy, qué está a
mitad de camino y qué es planificado, para que evalúes si se ajusta a tu caso de uso
antes de desplegarlo.

## Versión actual

`v1.0.0-alpha.4` — licencia [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0). El proyecto
todavía no llegó a una versión estable 1.0; puede haber cambios de esquema de base de
datos entre versiones alpha (ver [Actualización](/docs/despliegue/actualizacion)).

## Funcionalidades implementadas

Listas y en uso en producción interna:

- Mensajería completa: edición, reacciones, hilos, reenvío, fijados, guardados,
  borradores, búsqueda, recibos y formato markdown/bloques de código.
- Canales con descubrimiento, solicitudes de ingreso y moderación.
- Difusiones con destinatarios, envío programado y tracking de entrega.
- Encuestas con votación en tiempo real.
- RBAC aplicado por endpoint, audit log e infraestructura de jobs en background.
- Panel de administración: usuarios (con import LDAP), settings, auditoría, storage.
- Autenticación JWT + 2FA TOTP, sesiones multi-dispositivo.
- Dashboard de monitoreo del servidor, base de datos, HTTP y cron/socket.

## En progreso

- **Notificaciones push y email**: la UI de preferencias por evento ya existe, pero el
  envío real de Web Push (VAPID) y email (SMTP) todavía no está implementado — los
  toggles se guardan sin efecto de envío.
- **Difusiones**: falta sincronizar el contador `total_read` con los recibos de lectura
  reales.
- **Formato enriquecido**: markdown, barra de formato y bloques de código ya están
  implementados; faltan @menciones, previews de enlaces y mensajes de ubicación/contacto.

## Planificado

- **Pipeline de media seguro**: thumbnails automáticos, strip de EXIF, deduplicación por
  SHA256 y escaneo antivirus de adjuntos.
- **Llamadas WebRTC en producción**: señalización ya funciona; falta un SFU para
  llamadas grupales a mayor escala y grabación con consentimiento.
- **Retención de mensajes**: job de purga automática según `message_retention_days`.
- **Apps de escritorio (Electron) y móvil (React Native + Expo)**: comparten el mismo
  backend, pero todavía no se desarrollaron.

## Cómo contribuir al roadmap

El detalle completo de fases, esfuerzo estimado y dependencias vive en
[`docs/ROADMAP.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/ROADMAP.md)
dentro del repositorio. Si querés proponer o tomar una tarea, revisá esa guía y la de
[Contribuir](/docs/desarrollo/contribuir) antes de abrir una rama.

## Referencias

- [`docs/ROADMAP.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/ROADMAP.md) — roadmap detallado por fases
- [`docs/STYLE_GUIDE.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/STYLE_GUIDE.md) — convenciones de código
- [Arquitectura](/docs/arquitectura) — cómo se conectan las piezas hoy
