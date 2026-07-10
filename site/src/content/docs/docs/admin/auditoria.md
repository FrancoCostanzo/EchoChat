---
title: Auditoría
description: Visor de audit_log, filtros y acciones registradas.
---

Requiere el permiso `admin.view_audit`.

## Qué se audita

El `audit_log` registra acciones sensibles como login/logout, registro, cambio de
contraseña, alta/edición/eliminación de usuarios, reset de contraseña por un admin,
cambios de configuración del sistema, sincronización LDAP, eliminación de mensajes y
cambios de rol dentro de una conversación.

## Acceder al visor

Desde **Administración → Auditoría** (`/admin/audit`) se lista el log completo,
paginado y ordenable por fecha.

## Filtros disponibles

- **Acción** (p. ej. `admin.user_delete`, `user.login`)
- **Categoría**: `auth`, `admin`, `content`, `system`, `security`
- **Severidad**: `info`, `warning`, `critical`
- **Éxito**: si la acción se completó o falló
- **Rango de fechas**

## Interpretar registros

Cada fila muestra el actor (usuario que realizó la acción, enriquecido con su nombre),
la acción, el recurso afectado, si tuvo éxito, y metadatos adicionales. Las filas son
expandibles para ver el detalle completo (`metadata` en JSON, `duration_ms`, sesión
asociada).

## Acciones críticas

Marcadas con severidad `critical`, por ejemplo:

- `admin.user_delete` — eliminación de un usuario.

Marcadas con `warning`:

- `user.login` fallido, `user.change_password`, `admin.user_update`,
  `admin.user_reset_password`, `admin.setting_update`, `admin.ldap_sync`.

## Retención del log

El `audit_log` es **inmutable** por diseño: no hay una función de edición ni borrado
manual desde el panel. No hay, por ahora, una política de purga automática configurada.

## Exportación

El panel no incluye hoy una función de exportación (CSV/PDF) integrada; para análisis
externos, consultá la tabla `audit_log` directamente en PostgreSQL con permisos de solo
lectura.
