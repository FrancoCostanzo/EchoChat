---
title: Base de datos
description: Esquema PostgreSQL, migraciones y seed de RBAC para EchoChat.
---

## Preparación automática de la base

Desde `v1.0.0-alpha.5` **no hay que ejecutar ningún `psql` ni seed a mano**. Al
arrancar, el backend prepara la base de datos solo (código en
`backend/src/config/migrate.js`), en este orden:

1. **Espera** a que PostgreSQL acepte conexiones (reintenta, tolera que el backend
   arranque antes que la BD).
2. **Aplica el esquema base** (`backend/docs/messaging_intranet_schema.sql`, solo DDL)
   si la base está vacía.
3. **Corre las migraciones pendientes** de `backend/docs/migrations/`, registrando cada
   una en la tabla `schema_migrations` para no repetirla.
4. **Aplica el seed** (`backend/docs/seed.sql`) con los datos de referencia.
5. **Crea el primer administrador** desde `ADMIN_USERNAME`/`ADMIN_PASSWORD` si todavía no
   existe ningún `super_admin`.

Funciona igual con la BD del contenedor (`COMPOSE_PROFILES=postgres`) o con un PostgreSQL
externo. Se controla con `RUN_MIGRATIONS_ON_BOOT` (default `true`; ver
[Variables de entorno](/docs/despliegue/variables-entorno)).

:::note
La verdad sobre el estado de la base **no es el número de versión de la app**, es la tabla
`schema_migrations`: guarda qué migraciones ya corrieron. El runner solo aplica las que
faltan. Si una migración falla, corre en su propia transacción, hace *rollback* y el
backend **aborta** en vez de servir con una base a medias.
:::

Si preferís prepararla sin levantar la app (p. ej. una BD externa antes del despliegue):

```bash
cd backend && npm run migrate   # aplica esquema + migraciones + seed + primer admin
```

## Las tres piezas

| Pieza | Archivo | Qué contiene | Cuándo se aplica |
|-------|---------|--------------|-------------------|
| **Esquema base** | `messaging_intranet_schema.sql` | Solo DDL (30+ tablas, índices, funciones) | Una vez (se registra como `000_base_schema`) |
| **Migraciones** | `migrations/NNN_*.sql` | Cambios de esquema incrementales | Cada una una vez, en orden |
| **Seed** | `seed.sql` | Datos de referencia (roles, permisos, settings) | En **cada** arranque (idempotente, converge) |

## Migraciones

Las migraciones incrementales viven en `backend/docs/migrations/`. Son **idempotentes**
(`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP ... IF EXISTS`) y **append-only**: se
aplican en orden numérico y se registran en `schema_migrations`.

| Archivo | Qué hace |
|---------|----------|
| `003_add_user_wallpapers.sql` | Agrega soporte de wallpapers por usuario |
| `004_wallpaper_storage.sql` | Wallpapers respaldados por objetos de MinIO |
| `005_add_message_type_code.sql` | Agrega el tipo de mensaje `code` (bloques de código) |
| `006_ldap_and_registration.sql` | Soporte de LDAP y toggle de auto-registro |
| `007_message_encryption.sql` | Columnas para cifrado de mensajes en reposo |
| `008_drop_message_search_vector.sql` | Limpieza de búsqueda full-text |
| `009_audit_log_improvements.sql` | Agrega `severity`, `session_id`, `duration_ms`, `metadata` al audit log |
| `010_add_message_type_sticker.sql` | Agrega el tipo de mensaje `sticker` |
| `011_message_edit_delete_window.sql` | Settings `message_edit_window_minutes` y `message_delete_window_minutes` |
| `012_add_message_type_game.sql` | Agrega el tipo de mensaje `game` y la tabla `games` |
| `013_oidc_sso.sql` | Soporte de inicio de sesión OIDC/SSO |
| `014_monitoring_snapshots.sql` | Tabla de snapshots históricos para el dashboard de monitoreo |

:::note
Las migraciones arrancan en `003`. Las `001`/`002` sembraban RBAC y quedaron subsumidas
por `seed.sql`; se eliminaron. El antiguo `010_oidc_sso` (número duplicado) pasó a `013` y
`monitoring_snapshots` a `014`.
:::

## Seed: datos de referencia

`backend/docs/seed.sql` contiene los roles, permisos, su mapeo y la configuración por
defecto. **No son datos de ejemplo**: son datos que la app necesita para funcionar. Todo
usa `ON CONFLICT DO NOTHING`, así que el backend lo aplica en **cada** arranque para
*converger*: cuando se agrega un permiso o setting nuevo al seed, todas las instancias
existentes lo reciben en el próximo inicio, sin escribir una migración. Los permisos
nuevos se auto-asignan a `super_admin`/`admin` (usan `CROSS JOIN`).

Por eso, si una base quedó sin `role_permissions` (síntoma: `403 Missing required
permission`), basta con **reiniciar el backend**: el seed las repone. Ver el detalle de
roles y permisos en [RBAC](/docs/admin/rbac).

## Agregar un cambio de esquema (nueva versión)

Para la próxima versión, si necesitás tocar el esquema:

1. **Creá una migración** con el siguiente número correlativo, idempotente:

   ```sql
   -- backend/docs/migrations/015_pin_conversations.sql
   ALTER TABLE conversation_members
     ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
   ```

2. Si es **dato de referencia** (un permiso o setting nuevo), no hagas migración: editá
   `seed.sql` y listo (llega solo a todos en el próximo arranque).

3. **Nunca edites ni borres una migración ya publicada** — las instancias existentes ya la
   aplicaron y no la vuelven a correr. ¿Te equivocaste? Corregís con una migración nueva.

4. Preferí cambios **aditivos**. Para algo destructivo (renombrar/eliminar columna) usá
   *expand-contract* en dos versiones: primero agregás lo nuevo y hacés backfill, y en una
   versión posterior eliminás lo viejo. Así podés volver atrás el código sin tocar la BD.

El procedimiento operativo de actualización está en
[Actualización](/docs/despliegue/actualizacion).

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
