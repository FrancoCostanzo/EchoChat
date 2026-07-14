---
title: Configuración del sistema
description: Editor de system_settings y políticas globales.
---

Requiere el permiso `admin.settings`.

## Qué es system_settings

`system_settings` es una tabla clave-valor (`key` / `value` en JSONB) que centraliza
parámetros configurables de la plataforma sin necesidad de redeployar. El panel de
administración expone un editor por categoría.

## Categorías de configuración

| Categoría | Ejemplos de claves |
|-----------|---------------------|
| `general` | `message_retention_days`, `presence_timeout_minutes` |
| `messages` | `message_edit_window_minutes`, `message_delete_window_minutes` |
| `security` | `allow_registration` |
| `storage` | `storage_endpoint`, buckets por tipo, `presigned_url_ttl_seconds` |
| `media` | `max_image_size_mb`, `max_video_size_mb`, `max_document_size_mb`, `allowed_mime_types` |
| `groups` | `max_group_members` |
| `calls` | `call_recording_enabled`, `require_call_consent` |
| `broadcast` | `max_broadcast_recipients` |

## Editar valores

Cada clave se edita desde el panel con el tipo de dato correspondiente (booleano,
número, texto o JSON según el valor). El cambio se aplica de inmediato, sin reiniciar el
backend.

## Ventana de edición y eliminación

Por defecto, un usuario solo puede **editar** o **eliminar** sus propios mensajes durante
los primeros minutos tras enviarlos (soft delete: el mensaje queda como
“eliminado” en el chat). Ver [Mensajería](/docs/uso/mensajeria).

| Clave | Default | Descripción |
|-------|---------|-------------|
| `message_edit_window_minutes` | `15` | Minutos para editar un mensaje propio (`0` = sin límite) |
| `message_delete_window_minutes` | `15` | Minutos para eliminar un mensaje propio (`0` = sin límite) |

Quien tiene `messages.delete_any` puede eliminar mensajes fuera de esa ventana. Las
claves se siembran con la migración
`011_message_edit_delete_window.sql` (o el esquema base en instalaciones nuevas). Si las
claves no existen, el backend usa **15 minutos** por defecto.

## Retención de mensajes

`message_retention_days` (default `0` = sin límite) define cuántos días se conservan los
mensajes antes de purgarse automáticamente. El job de purga automática está planificado
pero **todavía no implementado** (ver [Estado del proyecto](/docs/estado)) — hoy cambiar
este valor no borra mensajes por sí solo.

## Impacto en la plataforma

Algunos valores afectan directamente el comportamiento en tiempo real, por ejemplo:

- `presence_timeout_minutes`: cuántos minutos de inactividad pasan a un usuario de
  `online` a `away` (evaluado cada minuto por el job `presence-timeout`).
- `message_edit_window_minutes` / `message_delete_window_minutes`: limitan edición y
  borrado propio; el menú del chat respeta la misma ventana por defecto.
- `allow_registration`: si está en `false`, oculta el enlace de registro en el login y
  bloquea `POST /api/auth/register`.
- `max_group_members`, límites de tamaño de archivo (`max_*_size_mb`) y
  `allowed_mime_types`: aplican en el momento de crear un grupo o subir un archivo.

## Auditoría de cambios

Cada cambio de configuración queda registrado en el [log de auditoría](/docs/admin/auditoria)
como `admin.setting_update`, con severidad `warning`.

## Valores recomendados

- `allow_registration=false` en producción si tu organización gestiona el alta de
  usuarios de forma centralizada (o si usás LDAP).
- Ajustá `presigned_url_ttl_seconds` según qué tan sensibles sean los adjuntos: un TTL
  más corto reduce la ventana de acceso de una URL filtrada.
- Revisá `allowed_mime_types` si necesitás permitir formatos adicionales de archivo.
