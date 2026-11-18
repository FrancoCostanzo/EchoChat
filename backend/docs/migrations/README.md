# Migraciones históricas (congeladas)

Estos `.sql` y `../messaging_intranet_schema.sql` armaban el esquema antes de pasar
a Kysely. Hoy equivalen a la migración TypeScript `src/config/db/migrations/001_initial.ts`.

**No agregues archivos acá.** Los cambios de esquema nuevos van en
`src/config/db/migrations/NNN_*.ts` (ver `docs/MULTI_DB.md` y `AGENTS.md`).

Sólo los lee `src/config/db/legacyMigrations.ts`, para que una base PostgreSQL creada
con el sistema viejo termine de aplicar los que le falten antes de marcar
`001_initial` como aplicada.
