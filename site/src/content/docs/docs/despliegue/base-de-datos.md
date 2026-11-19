---
title: Base de datos
description: Motores soportados (PostgreSQL y SQL Server), esquema, migraciones y seed de EchoChat.
---

## Motores soportados

EchoChat funciona sobre **PostgreSQL** (por defecto) y **SQL Server**. Se elige con
`DB_CLIENT`; el resto de las variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`) son las mismas (ver [Variables de entorno](/docs/despliegue/variables-entorno)).

| `DB_CLIENT` | Motor | Versión mínima | Puerto por defecto |
|-------------|-------|----------------|--------------------|
| `postgres` | PostgreSQL | 15 | 5432 |
| `mssql` | SQL Server | 2019 (probado con 2022) | 1433 |

Las consultas se escriben una sola vez con [Kysely](https://kysely.dev), que genera el SQL
de cada motor; lo que difiere entre motores está concentrado en `backend/src/config/db/`.
La suite de tests del backend corre completa contra los dos.

### SQL Server

```env
DB_CLIENT=mssql
DB_HOST=sqlserver.empresa.local
DB_PORT=1433
DB_NAME=echochat
DB_USER=echochat
DB_PASSWORD=...
DB_ENCRYPT=true            # recomendado fuera de una red de confianza
DB_TRUST_SERVER_CERT=false # con un certificado válido en el servidor
```

- La base (`DB_NAME`) tiene que **existir** y estar vacía; el backend crea las tablas.
- El usuario necesita permisos para crear tablas, índices y restricciones sobre esa base
  (por ejemplo el rol `db_owner`). Para el [dashboard de monitoreo](/docs/admin/monitoreo)
  hace falta además `VIEW SERVER STATE`.
- La collation por defecto (`*_CI_AS`) es la esperada: las búsquedas no distinguen mayúsculas.

:::note
Hoy no hay una herramienta para **mover** una instalación existente de PostgreSQL a SQL
Server con sus datos: SQL Server sirve para instalaciones nuevas.
:::

## Preparación automática de la base

**No hay que ejecutar ningún script a mano.** Al arrancar, el backend prepara la base solo
(código en `backend/src/config/migrate.ts`), en este orden:

1. **Espera** a que la base acepte conexiones (reintenta, tolera que el backend arranque
   antes que la BD).
2. **Aplica las migraciones pendientes** (`backend/src/config/db/migrations/`), registrando
   cada una en la tabla `kysely_migration` para no repetirla.
3. **Aplica el seed** (`backend/src/config/db/seed.ts`) con los datos de referencia.
4. **Crea el primer administrador** desde `ADMIN_USERNAME`/`ADMIN_PASSWORD` si todavía no
   existe ningún `super_admin`.

Funciona igual con la BD del contenedor (`COMPOSE_PROFILES=postgres`) o con una externa.
Se controla con `RUN_MIGRATIONS_ON_BOOT` (default `true`; ver
[Variables de entorno](/docs/despliegue/variables-entorno)).

:::note
La verdad sobre el estado de la base **no es el número de versión de la app**, es la tabla
`kysely_migration`: guarda qué migraciones ya corrieron. Si una migración falla, se hace
*rollback* y el backend **aborta** en vez de servir con una base a medias.
:::

Si preferís prepararla sin levantar la app (p. ej. una BD externa antes del despliegue):

```bash
cd backend && npm run migrate   # migraciones + seed + primer admin
```

## Las tres piezas

| Pieza | Dónde | Qué contiene | Cuándo se aplica |
|-------|-------|--------------|-------------------|
| **Esquema inicial** | `migrations/001_initial.ts` | El esquema completo (50+ tablas, índices, restricciones) | Una vez |
| **Migraciones** | `migrations/NNN_*.ts` | Cambios de esquema incrementales | Cada una una vez, en orden |
| **Seed** | `seed.ts` | Datos de referencia (roles, permisos, settings) | En **cada** arranque (sólo agrega lo que falta) |

## Instalaciones anteriores (PostgreSQL)

Hasta la versión en la que entró el soporte de varios motores, el esquema se armaba con
archivos `.sql` (`backend/docs/messaging_intranet_schema.sql` y `backend/docs/migrations/`)
registrados en `schema_migrations`. **No hay que hacer nada para actualizar**: al primer
arranque con la versión nueva, el backend termina de aplicar los `.sql` que le falten a esa
base y después marca `001_initial` como aplicada sin ejecutarla (es el mismo esquema).

Esos `.sql` quedan congelados: sólo se usan para ese paso. Conviene hacer un
[backup](/docs/despliegue/backups) antes, como en toda actualización.

## Seed: datos de referencia

`seed.ts` contiene los roles, permisos, su mapeo y la configuración por defecto. **No son
datos de ejemplo**: son datos que la app necesita para funcionar. Sólo inserta lo que falta,
así que el backend lo aplica en **cada** arranque para *converger*: cuando se agrega un
permiso o setting nuevo, todas las instancias existentes lo reciben en el próximo inicio, sin
escribir una migración. Los permisos nuevos se asignan solos a `super_admin`/`admin`.

Por eso, si una base quedó sin `role_permissions` (síntoma: `403 Missing required
permission`), basta con **reiniciar el backend**: el seed las repone. Ver el detalle de
roles y permisos en [RBAC](/docs/admin/rbac).

## Agregar un cambio de esquema (nueva versión)

1. **Creá una migración** con el siguiente número correlativo y registrala en
   `migrations/index.ts`. Se escribe con el schema builder de Kysely y los helpers de tipos
   de `schema.ts` (`t.uuid()`, `t.varchar(n)`, `t.timestamptz()`, `t.json()`, …), que dan el
   tipo correcto en cada motor:

   ```ts
   // backend/src/config/db/migrations/004_pin_conversations.ts
   import type { Kysely } from 'kysely';
   import { t } from '../schema';

   export async function up(db: Kysely<any>): Promise<void> {
     await db.schema.alterTable('conversation_members')
       .addColumn('pinned_at', t.timestamptz())
       .execute();
   }
   ```

   Lo que sólo exista en un motor va dentro de `onPostgres()` / `onMssql()`.

2. Si es **dato de referencia** (un permiso o setting nuevo), no hagas migración: editá
   `seed.ts` y listo (llega solo a todos en el próximo arranque).

3. **Nunca edites ni borres una migración ya publicada** — las instancias existentes ya la
   aplicaron y no la vuelven a correr. ¿Te equivocaste? Corregís con una migración nueva.

4. Preferí cambios **aditivos**. Para algo destructivo (renombrar/eliminar columna) usá
   *expand-contract* en dos versiones: primero agregás lo nuevo y hacés backfill, y en una
   versión posterior eliminás lo viejo. Así podés volver atrás el código sin tocar la BD.

El procedimiento operativo de actualización está en
[Actualización](/docs/despliegue/actualizacion).

## Extensiones PostgreSQL

En PostgreSQL el esquema usa estas extensiones (se crean automáticamente si el usuario tiene
permisos, o hay que instalarlas a mano antes):

- `uuid-ossp` — generación de UUIDs como clave primaria
- `pgcrypto` — funciones criptográficas
- `pg_trgm` y `btree_gin` — índices para búsquedas frecuentes

SQL Server no necesita nada equivalente.

## Conexión y pool

El backend mantiene un pool de conexiones configurado por `DB_POOL_MIN`/`DB_POOL_MAX`
(default `2`/`20`): el driver `pg` en PostgreSQL y `tedious` + `tarn` en SQL Server. El
estado del pool es visible en el [dashboard de monitoreo](/docs/admin/monitoreo).

## Mantenimiento

- El dashboard de monitoreo expone el tamaño de la base, las sesiones activas
  (`pg_stat_activity` en PostgreSQL, `sys.dm_exec_sessions` en SQL Server) y la latencia de
  una consulta de referencia (`SELECT 1`).
- En PostgreSQL, ejecutá `VACUUM`/`ANALYZE` periódicos según el volumen de mensajes y la
  política de autovacuum; en SQL Server, el mantenimiento de índices y estadísticas habitual.
- Ver [Backups](/docs/despliegue/backups) para la estrategia de respaldo.

## Troubleshooting de BD

Ver la sección específica en [Troubleshooting](/docs/despliegue/troubleshooting#errores-de-conexión-a-postgresql).
