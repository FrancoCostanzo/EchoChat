# Soporte para varios motores de base de datos

> Estado: **etapa 0 hecha** (Kysely conectado, `draft.repository` migrado como piloto).
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

### Etapa 1 — Migraciones en TypeScript (≈3–4 días, la más delicada)
- Pasar el schema base, las 22 migraciones y el `seed.sql` a migraciones de Kysely
  (`src/db/migrations/NNN_*.ts`) con un runner propio que conserva la semántica actual: el
  esquema y las migraciones se aplican una vez y el seed converge en cada arranque.
- **Baseline de bases existentes:** si `schema_migrations` ya tiene `000_base_schema` y las 22, se
  marcan como aplicadas las migraciones TS equivalentes sin ejecutar nada.
- **Verificación:** el `pg_dump --schema-only` de una base creada con las migraciones nuevas
  tiene que coincidir con el de una creada con los `.sql` actuales (salvo el orden).
- Los triggers y funciones **todavía no se tocan**: en PostgreSQL se crean igual que hoy.

### Etapa 2 — Repositorios a Kysely, sólo PostgreSQL (≈6–8 días)
- Uno por uno, de los simples a los complejos (`wallpaper`, `draft`, `saved`… → `conversation`,
  `message`, `monitoring`). Mismo SQL resultante, mismos tests.
- Los casos raros (`json_agg`, `LATERAL`, `FOR UPDATE SKIP LOCKED`) primero con `sql` crudo de
  Kysely, para no frenar.
- El SQL que vive fuera de los repositorios (`auth.service`, jobs, health) pasa a repositorios.

### Etapa 3 — Sacar lo exclusivo de PostgreSQL del código (≈3–4 días)
- Helpers por dialecto (`now`, `addInterval`, `ilike`, `upsert`, `jsonText`, `lockForUpdate`).
- Triggers y funciones → código de la app, más una migración que los borra en PostgreSQL.
- Columnas array → JSON (migración que convierte los datos existentes).
- `FILTER (WHERE)` → `CASE`.

### Etapa 4 — Tipos portables en el schema builder (≈2 días)
- Helpers de columna (`uuid()`, `timestamp()`, `json()`, `ip()`) que devuelven el tipo de cada
  motor. Índices GIN sólo en PostgreSQL.

### Etapa 5 — Dialecto SQL Server (≈5–7 días)
- `MssqlDialect` de Kysely (`tedious` + `tarn`), implementación de los helpers para SQL Server
  y monitoreo con `sys.dm_exec_sessions`.
- Contenedor de tests `mcr.microsoft.com/mssql/server:2022-latest` y `npm test` con
  `DB_CLIENT=mssql`. Hay que arreglar lo que la suite encuentre.
- Versión mínima propuesta: **SQL Server 2019** (por `JSON_VALUE`, `STRING_AGG` y `OFFSET/FETCH`).

### Etapa 6 — Documentación y CI (≈1 día)
- README, `.env.example` y guía de instalación con `DB_CLIENT`.
- CI que corre la suite contra los dos motores (si se quiere agregar CI del backend).

**Total estimado: 3 a 4 semanas** de trabajo efectivo. MySQL/MariaDB después es mucho más
barato (≈1 semana), porque el esfuerzo grande —Kysely, helpers y sacar los triggers— ya
está hecho.

## Fuera de alcance (por ahora)
- Migrar datos de una instalación PostgreSQL existente a SQL Server (se puede sumar una
  herramienta de exportación e importación después).
- Particionado de `messages` (hoy sólo está como comentario en el schema).
