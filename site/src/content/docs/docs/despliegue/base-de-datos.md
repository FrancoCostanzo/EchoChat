---
title: Base de datos
description: Esquema PostgreSQL, migraciones y seed de RBAC para EchoChat.
---

## Esquema inicial

El esquema completo (30+ tablas) vive en un único archivo:
`backend/docs/messaging_intranet_schema.sql`. En despliegues con Docker se aplica
automáticamente en el primer arranque; para instalaciones manuales o con PostgreSQL
externo hay que ejecutarlo a mano:

```bash
psql -U echochat -d echochat -f backend/docs/messaging_intranet_schema.sql
```

## Migraciones

Las migraciones incrementales viven en `backend/docs/migrations/` y deben aplicarse **en
orden** sobre una base ya inicializada con el esquema base:

| Archivo | Qué hace |
|---------|----------|
| `001_seed_role_permissions.sql` | Siembra `role_permissions` (roles → permisos) |
| `002_bootstrap_rbac.sql` | Bootstrap completo de RBAC si `roles`/`permissions` quedaron vacías |
| `003_add_user_wallpapers.sql` | Agrega soporte de wallpapers por usuario |
| `004_wallpaper_storage.sql` | Wallpapers respaldados por objetos de MinIO |
| `005_add_message_type_code.sql` | Agrega el tipo de mensaje `code` (bloques de código) |
| `006_ldap_and_registration.sql` | Soporte de LDAP y toggle de auto-registro |
| `007_message_encryption.sql` | Columnas para cifrado de mensajes en reposo |
| `008_drop_message_search_vector.sql` | Limpieza de búsqueda full-text |
| `009_audit_log_improvements.sql` | Agrega `severity`, `category`, `session_id`, `duration_ms`, `metadata` al audit log |
| `010_add_message_type_sticker.sql` | Agrega el tipo de mensaje `sticker` |
| `010_oidc_sso.sql` | Soporte de inicio de sesión OIDC/SSO |
| `011_message_edit_delete_window.sql` | Settings `message_edit_window_minutes` y `message_delete_window_minutes` |
| `monitoring_snapshots.sql` | Tabla de snapshots históricos para el dashboard de monitoreo |

Todas son **idempotentes** (`ON CONFLICT DO NOTHING` o equivalentes), se pueden correr
más de una vez sin duplicar datos.

## Seed de permisos RBAC

Si una base existente quedó sin `role_permissions` pobladas (síntoma: todos los usuarios
reciben `403 Missing required permission`), corré:

```bash
psql -U echochat -d echochat -f backend/docs/migrations/001_seed_role_permissions.sql
```

Esto asigna todos los permisos a `super_admin`/`admin`, un set de moderación a
`moderator` y los permisos estándar a `user`. Ver el detalle de roles y permisos en
[RBAC](/docs/admin/rbac).

## Extensiones PostgreSQL

El esquema requiere estas extensiones (se crean automáticamente si el usuario tiene
permisos, o hay que instalarlas manualmente antes):

- `uuid-ossp` — generación de UUIDs como clave primaria
- `pg_trgm` — búsqueda full-text por trigramas
- `btree_gin` — índices compuestos para patrones de búsqueda frecuentes

## Conexión y pool

El backend usa el driver `pg` con un pool de conexiones configurado por
`DB_POOL_MIN`/`DB_POOL_MAX` (default `2`/`20`). El estado del pool (conexiones activas,
libres, en espera) es visible en tiempo real en el
[dashboard de monitoreo](/docs/admin/monitoreo).

## Mantenimiento

- El dashboard de monitoreo expone tamaño de la base de datos, `pg_stat_activity` y
  latencia de una consulta de referencia (`SELECT 1`).
- Se recomienda ejecutar `VACUUM`/`ANALYZE` periódicos según el volumen de mensajes y la
  política de autovacuum de tu instancia de PostgreSQL.
- Ver [Backups](/docs/despliegue/backups) para la estrategia de respaldo.

## Troubleshooting de BD

Ver la sección específica en [Troubleshooting](/docs/despliegue/troubleshooting#errores-de-conexión-a-postgresql).
