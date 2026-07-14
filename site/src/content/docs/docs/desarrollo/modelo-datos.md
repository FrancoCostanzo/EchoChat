---
title: Modelo de datos
description: Tablas PostgreSQL por módulo, relaciones y extensiones.
---

## Vista general

El esquema completo (30+ tablas) vive en un único archivo SQL:
`backend/docs/messaging_intranet_schema.sql`. Las migraciones incrementales están en
`backend/docs/migrations/` (ver [Base de datos](/docs/despliegue/base-de-datos)). Todo
identificador es UUID; las tablas siguen `snake_case` estrictamente.

## Autenticación y usuarios

| Tabla | Descripción |
|-------|--------------|
| `users` | Usuario principal con perfil (departamento, cargo, extensión, presencia) |
| `user_credentials` | Contraseña hasheada, bloqueo de cuenta, historial |
| `user_sessions` | Sesiones multi-dispositivo con hash del JWT |
| `roles` / `permissions` / `role_permissions` | RBAC global (ver [RBAC](/docs/admin/rbac)) |
| `user_roles` | Asignación de roles a cada usuario |
| `user_relationships` | Contactos, bloqueados, favoritos |

## Mensajería

| Tabla | Descripción |
|-------|--------------|
| `messages` | Mensaje principal (`type`, `body`, `body_format`, `thread_id`, `reply_to_id`; soft delete → `is_deleted` + `deleted_placeholder`) |
| `message_edits` | Historial de ediciones (ventana `message_edit_window_minutes`) |
| `message_receipts` | Entrega/lectura por destinatario (también alimenta métricas de difusión) |
| `message_reactions` | Reacciones con emoji |
| `message_attachments` | Vínculo mensaje ↔ `storage_objects` |
| `saved_messages` | Mensajes guardados por usuario |
| `pinned_messages` | Mensajes fijados por conversación |
| `drafts` | Borradores auto-guardados por conversación |

## Conversaciones y canales

| Tabla | Descripción |
|-------|--------------|
| `conversations` | Fila única para direct/group/channel/broadcast (`type`) |
| `conversation_members` | Membresía, rol por conversación, estado de lectura |
| `conversation_events` | Log de auditoría de eventos del grupo |
| `channel_settings` | Categoría, `join_mode`, `is_official`, `is_discoverable`, `member_count` |
| `channel_join_requests` | Solicitudes de ingreso pendientes/aprobadas/rechazadas |

## Llamadas

| Tabla | Descripción |
|-------|--------------|
| `calls` | `initiated_at`, `answered_at`, `ended_at`, `duration_seconds` (por trigger) |
| `call_participants` | Estado individual por participante |
| `call_recordings` | Referencia a grabación + consentimiento (`consented_by`) |

## Difusiones y encuestas

| Tabla | Descripción |
|-------|--------------|
| `broadcast_lists` | Lista de difusión |
| `broadcast_recipients` | Destinatarios (individuales o por departamento) |
| `broadcast_messages` | Mensaje enviado a la lista, con `scheduled_at` opcional |
| `broadcast_deliveries` | Fan-out por destinatario; recibido/leído se cruzan con `message_receipts` |
| `polls` / `poll_options` / `poll_votes` | Encuesta, opciones con conteo desnormalizado, votos individuales |

## Notificaciones y sistema

| Tabla | Descripción |
|-------|--------------|
| `notifications` | Registro por evento y destinatario |
| `notification_preferences` | Preferencias por usuario y tipo de evento |
| `system_settings` | Configuración clave-valor por categoría (ver [Configuración del sistema](/docs/admin/sistema)) |
| `audit_log` | Log inmutable con `severity`, `category`, `metadata` |

## Almacenamiento

| Tabla | Descripción |
|-------|--------------|
| `storage_objects` | Inventario de archivos en MinIO (bucket, key, hash, `processing_status`) |
| `storage_presigned_urls` | Caché de URLs prefirmadas con expiración |

El backend nunca guarda rutas de filesystem ni binarios: solo referencias a MinIO.

## Extensiones PostgreSQL

- `uuid-ossp` — generación de UUIDs
- `pg_trgm` — búsqueda full-text por trigramas (`idx_users_display_name_trgm`, etc.)
- `btree_gin` — índices compuestos para patrones de búsqueda frecuentes

## Índices y rendimiento

Índices parciales y compuestos orientados a los patrones de consulta más frecuentes, por
ejemplo:

- `idx_messages_conversation` — mensajes por conversación, solo no eliminados
- `idx_conv_members_user` / `idx_conv_members_conv` — miembros activos (`left_at IS NULL`)
- `idx_receipts_user_unread` — recibos pendientes de lectura por usuario
- `idx_notifications_unread` — notificaciones no leídas por destinatario
- `idx_storage_hash` — búsqueda por hash SHA256 (preparado para deduplicación futura)

Triggers mantienen campos desnormalizados actualizados automáticamente:
`conversations.last_message_at`/`last_message_id` al insertar un mensaje,
`calls.duration_seconds` al finalizar una llamada, y `channel_settings.member_count` al
entrar/salir un miembro.
