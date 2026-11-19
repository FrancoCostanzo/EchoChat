# Soporte para varios motores de base de datos

> Estado: **etapas 0, 1 y 2 hechas** (Kysely conectado; esquema, migraciones y seed en TypeScript;
> los 25 repositorios consultan con Kysely). Etapa 3 en curso: triggers, funciones, columnas
> array y consultas del timeline ya resueltos. **Etapa 5 adelantada:** el esquema completo ya se
> crea en SQL Server 2022; falta adaptar las consultas (upserts, `RETURNING`, etc.).
> Motores: PostgreSQL (actual) → **SQL Server** (primero) → MySQL/MariaDB y SQLite más adelante.

## Decisiones

| Tema | Decisión | Por qué |
|------|----------|---------|
| Consultas | **Kysely** (query builder tipado) | Genera el SQL de cada motor y se sigue leyendo como SQL. `src/types/db.d.ts` ya sale de `kysely-codegen`, así que los tipos de tablas ya existen. |
| Esquema y migraciones | **Migraciones en TypeScript** con el schema builder de Kysely | El esquema se escribe una vez y cada motor recibe su DDL. Se terminan los `.sql` a mano. |
| Primer motor nuevo | **SQL Server** | Es el más común en intranets con Windows y Active Directory, que es el público de EchoChat (LDAP y SCIM ya están). |
| Entrega | **Por etapas**, un commit por etapa en `feat/multi-db` | PostgreSQL tiene que seguir funcionando igual en cada paso, con la suite en verde. |

Selección del motor por entorno: `DB_CLIENT=postgres|mssql` (por defecto `postgres`).
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` siguen igual.

## Punto de partida (medido)

- **25 repositorios**, unas 4500 líneas, **255 consultas** SQL escritas a mano.
- SQL fuera de los repositorios en `auth.service`, `monitoring.service`, dos jobs, `app.ts`
  (health check), `config/database.ts` y `config/migrate.ts`.
- Esquema: `docs/messaging_intranet_schema.sql` (926 líneas) + 22 migraciones + `seed.sql`.

Lo que no existe tal cual en SQL Server y hay que resolver:

| PostgreSQL | Usos | En SQL Server | Cómo lo resolvemos |
|------------|------|---------------|--------------------|
| `RETURNING` | 85 | `OUTPUT inserted.*` | Kysely lo traduce (`.returning()` / `.output()`); helper común. |
| `ON CONFLICT` (upsert) | 20 | `MERGE` | Helper `upsert()` por dialecto. |
| `NOW()`, `INTERVAL` | 87 / 15 | `SYSDATETIMEOFFSET()`, `DATEADD` | Helpers `now()` y `addInterval()` por dialecto. |
| Casts `::tipo` | 57 | `CAST(... AS ...)` | Pasan a `cast()` de Kysely o desaparecen. |
| `ILIKE` | 7 | Collation `_CI_` (case-insensitive) | Helper `ilike()`. |
| `ANY($1)` con arrays | 8 | `IN (...)` | `where(col, 'in', lista)`. |
| `FILTER (WHERE …)` | 10 | `SUM(CASE WHEN …)` | Reescribir con `CASE` (vale en los dos). |
| JSONB y `->>` | 22 cols / 10 consultas | `NVARCHAR(MAX)` + `JSON_VALUE` | Helper `jsonText(col, 'campo')`; el JSON se parsea en el modelo. |
| `json_agg`, `array_agg` | 13 | `FOR JSON` / `STRING_AGG` | Reescribir como dos consultas o con helper por dialecto. |
| Columnas array (`TEXT[]`, `UUID[]`, `SMALLINT[]`) | 5 | No existen | Columna JSON con la lista (son listas chicas: días, keywords, códigos de respaldo). |
| `FOR UPDATE SKIP LOCKED` | 4 | `WITH (UPDLOCK, READPAST)` | Helper `lockForUpdate()`. |
| `LATERAL` | 2 | `CROSS/OUTER APPLY` | Kysely lo soporta en ambos. |
| `UUID` / `gen_random_uuid` | 151 cols | `UNIQUEIDENTIFIER` / `NEWID()` | Tipo por dialecto en el schema builder. |
| `TIMESTAMPTZ` | 102 | `DATETIMEOFFSET` | Tipo por dialecto. |
| `INET` | 2 | No existe | `VARCHAR(45)`. |
| Índices GIN / `pg_trgm` / `btree_gin` | 33 | No existen | Índices comunes donde sirvan; la búsqueda de mensajes ya usa `message_search_tokens`, que es portable. |
| Extensiones (`pgcrypto`, `uuid-ossp`…) | 4 | No aplica | Sólo en el dialecto PostgreSQL. |
| 4 funciones y 7 triggers (`updated_at`, `last_message` de la conversación, `member_count` de canales, duración de llamadas) | 11 | Sintaxis distinta | **Pasan al código** (servicios/repositorios), así se comportan igual en todos los motores. |
| `pg_stat_activity` (monitoreo) | 2 | `sys.dm_exec_sessions` | Repositorio de monitoreo por dialecto. |
| Collation y orden | — | Varía | Comparaciones de texto con collation explícita donde importe. |

## Etapas

Cada etapa termina con `tsc` limpio, la suite de integración en verde contra PostgreSQL y un
commit. Desde la etapa 5 la suite corre también contra SQL Server.

### Etapa 0 — Infraestructura ✅
- `kysely` pasó de `devDependencies` a `dependencies` (en la etapa 5 se suman `tedious` + `tarn`).
- `src/config/db/`: dialecto según `DB_CLIENT` (hoy sólo `postgres`; otro valor corta el
  arranque con un mensaje claro), instancia `db` de Kysely sobre el **mismo pool de `pg`** y
  helper `transaction()`. Las consultas de Kysely se cuentan en las métricas igual que las de `pg`.
- `BaseRepository` expone `this.db` además de `query()`.
- Piloto: `draft.repository` (upsert con `onConflict`, `returningAll`, select, delete).
  `now()` queda como `sql` crudo hasta los helpers de la etapa 3.

### Etapa 1 — Migraciones en TypeScript ✅
- `src/config/db/migrations/001_initial.ts`: el esquema completo (schema base + migraciones
  003–024) con el schema builder de Kysely. Se generó leyendo el catálogo de una base creada
  con los `.sql` y los CHECK se reescribieron como `col IN (...)`, que es SQL portable.
- `src/config/db/schema.ts`: helpers de tipos (`t.uuid()`, `t.timestamptz()`, `t.json()`…),
  defaults (`d.now()`, `d.uuid()`) y `onPostgres()` para lo exclusivo de PostgreSQL
  (extensiones, 4 índices GIN/de expresión, 4 funciones, 7 triggers, comentarios).
- `src/config/db/seed.ts` reemplaza a `docs/seed.sql`.
- `src/config/migrate.ts` usa el `Migrator` de Kysely (tabla `kysely_migration`). Bases del
  sistema viejo: `legacyMigrations.ts` aplica las `.sql` que falten y después registra
  `001_initial` sin ejecutarla. Los `.sql` quedan congelados (`docs/migrations/README.md`).
- **Verificado:** el `pg_dump --schema-only` de una base nueva es idéntico línea por línea al
  del sistema viejo, y el seed da las mismas 139 filas. Probado también con una base vieja al
  día (baseline sin cambios) y con una atrasada hasta la 022 (aplica 023–024 y queda idéntica).
  Suite: 118/119 sobre base vieja y sobre base vacía (el fallo, "fijar y dejar de fijar", ya
  existía).
- Los triggers y funciones **todavía no se tocan**: en PostgreSQL se crean igual que hoy.
- Pendiente para la etapa 6: la guía pública (`site/…/despliegue/base-de-datos.md` y
  `actualizacion.md`) todavía describe los `.sql`.

### Etapa 2 — Repositorios a Kysely, sólo PostgreSQL ✅
- Uno por uno, de los simples a los complejos (`wallpaper`, `draft`, `saved`… → `conversation`,
  `message`, `monitoring`). Mismo SQL resultante, mismos tests.
- Los casos raros (`json_agg`, `LATERAL`, `FOR UPDATE SKIP LOCKED`) primero con `sql` crudo de
  Kysely, para no frenar.
- El SQL que vive fuera de los repositorios (`auth.service`, jobs, health) pasa a repositorios.

**Hecho (25 de 25).** No queda SQL a mano en repositorios ni servicios: `BaseRepository` ya no
expone `query()`. Lo que sigue usando el `pool` de `pg` directamente es exclusivo de PostgreSQL
a propósito: las migraciones históricas (`legacyMigrations.ts`), el advisory lock de
`migrate.ts` y el estado del pool en el monitoreo. Los health checks usan `pingDb()`.

Las tres consultas de timeline de `message` (con `json_agg` de adjuntos y reacciones) quedaron
como fragmentos `sql` de Kysely con el mismo texto: en la etapa 3 se parten en consultas
simples que se arman en la app.

Expresiones por motor en `src/config/db/sql.ts`: `now()`, `nowPlus()`, `nowMinus()`, `ilike()`, `jsonText()`, `asText()`, `json()`.
Quedan como PostgreSQL a propósito, para la etapa 3: `onConflict` (upserts), `returning`,
`forUpdate().skipLocked()`, `leftJoinLateral`, `array_remove` sobre `totp_backup_codes`, el
`unnest` de `user_stickers.keywords`, el `jsonb_build_object` de `call.recordQuality`,
`NULLS LAST` (lista de chats y entregas de difusiones), el intervalo que depende de una
columna en `email.markFailed` y las vistas del sistema de `monitoring` (`pg_stat_activity`,
que en SQL Server se reemplazan por `sys.dm_exec_sessions`).

Cambios de forma (mismo resultado): `deviceHistory` hace dos consultas chicas en vez de un
`EXISTS` doble con `IS NOT DISTINCT FROM`, `markFailed` actualiza y después borra en vez de
un CTE con `DELETE … USING`, los `ORDER BY (status = 'pending')` pasan a `CASE`, los `COUNT(*) FILTER (WHERE …)` a
`SUM(CASE …)` y `storage.countReferences` hace una consulta por tabla en vez de una suma de subconsultas.

**Hallazgos de la etapa 2 (no corregidos, mismo comportamiento que antes):**
- `message.deleteAttachments` borra los adjuntos y *después* busca en esa misma tabla qué
  `storage_objects` borrar, así que nunca borra ninguno.
- `user.disableLdapUsersNotIn` manda todos los ids del directorio en un parámetro array; en SQL
  Server (límite de 2100 parámetros) hay que resolverlo con una tabla temporal.
- El test `fijar y dejar de fijar` fallaba desde antes de empezar: leía `/pinned` como lista y el
  endpoint devuelve un solo mensaje (o null). Corregido el test; la suite da 119/119 en los dos motores. `el TOTP del autenticador sigue funcionando en paralelo`
  falla a veces por la ventana de 30 s del TOTP.

### Etapa 3 — Sacar lo exclusivo de PostgreSQL del código (≈3–4 días)
- Helpers por dialecto (`now`, `addInterval`, `ilike`, `upsert`, `jsonText`, `lockForUpdate`).
- ✅ Triggers y funciones → código de la app, más una migración que los borra en PostgreSQL
  (`002_drop_triggers`): `updated_at` lo pone `UpdatedAtPlugin` (plugin de Kysely que agrega
  `updated_at = now()` a todo UPDATE de `users`, `conversations`, `channel_settings` y
  `broadcast_lists`), la duración de la llamada se calcula en `call.updateStatus`, el
  `member_count` de canales se recalcula en `conversation.add/removeMember` y el último mensaje
  de la conversación se fija en `message.create`, estos dos últimos en la misma transacción.
- ✅ Columnas array → JSON (`003_arrays_to_json`, convierte los datos existentes):
  `user_credentials.totp_backup_codes`, `user_stickers.keywords`,
  `user_notification_settings.quiet_days` y `call_recordings.consented_by`. Las escrituras pasan
  por `json()`; `array_remove` se reemplazó por un filtro en la app y la búsqueda en `keywords`
  usa el helper `jsonArrayLike()`. Como kysely-codegen tipa esas columnas como `Json`, su tipo
  real (lista) se declara en `types/rows.d.ts`.
- `FILTER (WHERE)` → `CASE`.
- ✅ Timeline de mensajes sin `json_agg`/`ARRAY_AGG`: `findByConversation`, `findWithAttachments`,
  `findThreadReplies` y `getReactions` hacen una consulta de mensajes con el builder y traen
  adjuntos y reacciones por lote de ids (dos consultas), que se arman en la app. Verificado con
  datos de prueba (respuestas, hilo, adjuntos en orden, reacciones, acuses, guardados): mismos
  valores y tipos que antes.

### Etapa 4 — Tipos portables en el schema builder (≈2 días)
- Helpers de columna (`uuid()`, `timestamp()`, `json()`, `ip()`) que devuelven el tipo de cada
  motor. Índices GIN sólo en PostgreSQL.

### Etapa 5 — Dialecto SQL Server (en curso, adelantada)

**Hecho:**
- `DB_CLIENT=mssql` con `MssqlDialect` de Kysely (`tedious` 19 + `tarn` 3). Opciones nuevas:
  `DB_ENCRYPT` (por defecto `false`) y `DB_TRUST_SERVER_CERT` (por defecto `true`); el puerto por
  defecto pasa a 1433 con `mssql`.
- `schema.ts` con la rama de SQL Server: `uniqueidentifier`, `nvarchar`, `bit`, `datetimeoffset`,
  `bigint IDENTITY`, `NEWID()`, `SYSDATETIMEOFFSET()`, booleanos `1/0` (`d.bool`) y `t.keyText(n)`
  para las columnas de texto que son clave o índice (SQL Server no indexa `nvarchar(max)`).
- `001_initial` corre completa en SQL Server (las 3 migraciones, 51 tablas, 101 FKs, 44 CHECK) y en
  PostgreSQL sigue dando un `pg_dump` idéntico al histórico. Ajustes: CHECK y WHERE de índices
  parciales sin casts `::`, la FK diferible `conversations.last_message_id` sólo en PostgreSQL, y
  dos UNIQUE sobre columnas con NULL (`users.email`, `storage_presigned_urls`) como índices únicos
  filtrados en SQL Server, que si no admitiría un solo NULL.
- 8 FKs quedan sin `ON DELETE` en SQL Server por *multiple cascade paths* (`onDeleteExceptMssql`):
  `pinned_messages.message_id`, `poll_votes.poll_id`, `user_relationships.user_id`,
  `games.message_id`, `user_stickers.pack_id`, `auto_reply_log.peer_user_id`,
  `scheduled_messages.sent_message_id`, `message_reminders.message_id`. Sus tablas padre sólo se
  borran lógicamente, salvo `sticker_packs`: `deletePack` desvincula los stickers antes de borrar.
- Para poder instalar el driver hubo que pasar a Express 5 (rama `fix/express-5`): se quitó
  `express-async-errors`, que rompía el arranque.

**Consultas en SQL Server** (sin una versión de cada consulta por motor):
- `MssqlPlugin` (`src/config/db/mssqlPlugin.ts`, sólo con `mssql`) reescribe el árbol de cada
  consulta: `limit` → `TOP`/`OFFSET…FETCH`, `returning` → `OUTPUT inserted.*|deleted.*`,
  `NULLS LAST` → `CASE` en el ORDER BY, `FOR UPDATE SKIP LOCKED` → `WITH (UPDLOCK, READPAST,
  ROWLOCK)`, `LEFT JOIN LATERAL … ON TRUE` → `OUTER APPLY`, `ON true` → `ON 1 = 1`,
  `EXISTS(…) AS x` en el SELECT → `CAST(CASE WHEN EXISTS(…) THEN 1 ELSE 0 END AS bit)` y
  `UPDATE t AS a` → `UPDATE a … FROM t AS a`. En los resultados pasa los GUID a minúscula y
  parsea las columnas JSON (que SQL Server guarda como texto).
- La búsqueda por índice ciego y los candidatos a links ya no agrupan por `m.*` (SQL Server no
  lo admite): una subconsulta trae los ids y después los mensajes.
- `src/config/db/upsert.ts`: `upsert()` e `insertIgnore()` reemplazan a los 28 `onConflict`. En
  PostgreSQL siguen siendo `ON CONFLICT`; en SQL Server se intenta el INSERT y, ante violación de
  la clave única (2627/2601), se hace el UPDATE o se ignora. Los `INSERT … SELECT` usan `NOT EXISTS`.
- Helpers de `sql.ts` con las dos ramas: `now`, `nowPlus/nowMinus` (`DATEADD`), `secondsSince`
  (`DATEDIFF`), `ilike` (`LIKE` con collation CI), `jsonText` (`JSON_VALUE`), `asText`,
  `jsonArrayLike` (`OPENJSON`), `bool`. `disableLdapUsersNotIn` manda los ids como un único JSON
  (`OPENJSON`) para no chocar con el tope de 2100 parámetros.
- `call.recordQuality` arma el resumen de calidad en la app (antes operadores JSONB).
- Monitoreo con `sys.dm_exec_sessions`/`sys.dm_exec_requests` y `sys.database_files`.
- `closeDb()` cierra el pool del motor activo al apagar (antes `pool.end()` sólo de `pg`).

**Plan original:**
- `MssqlDialect` de Kysely (`tedious` + `tarn`), implementación de los helpers para SQL Server
  y monitoreo con `sys.dm_exec_sessions`.
- Contenedor de tests `mcr.microsoft.com/mssql/server:2022-latest` y `npm test` con
  `DB_CLIENT=mssql`. Hay que arreglar lo que la suite encuentre.
- Versión mínima propuesta: **SQL Server 2019** (por `JSON_VALUE`, `STRING_AGG` y `OFFSET/FETCH`).

### Etapa 6 — Documentación ✅
- `DB_CLIENT`, `DB_ENCRYPT` y `DB_TRUST_SERVER_CERT` en los dos `.env.example`, el README y la
  guía pública (`site/…/despliegue/base-de-datos.md`, `variables-entorno.md`, `actualizacion.md`),
  que ahora describe las migraciones en TypeScript, los dos motores y el paso automático de las
  instalaciones viejas.
- CI del backend: fuera de alcance por ahora (no hay workflow de backend).

**Total estimado: 3 a 4 semanas** de trabajo efectivo. MySQL/MariaDB después es mucho más
barato (≈1 semana), porque el esfuerzo grande —Kysely, helpers y sacar los triggers— ya
está hecho.

## Fuera de alcance (por ahora)
- Migrar datos de una instalación PostgreSQL existente a SQL Server (se puede sumar una
  herramienta de exportación e importación después).
- Particionado de `messages` (hoy sólo está como comentario en el schema).
