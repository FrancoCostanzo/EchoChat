---
title: Actualización
description: Procedimiento para actualizar EchoChat y aplicar migraciones.
---

## Flujo de actualización

1. Hacé un [backup](/docs/despliegue/backups) de la base de datos y de MinIO antes de actualizar.
2. Traé el código nuevo:

   ```bash
   git pull origin main
   ```

3. Reconstruí y reiniciá (ver [Reconstrucción de contenedores](#reconstrucción-de-contenedores)).
   Al arrancar, el backend **aplica solo** las migraciones y el seed pendientes.
4. Verificá `GET /api/health/ready` antes de considerar la actualización completa.

## Migraciones de base de datos

El backend **aplica las migraciones automáticamente** al arrancar: compara las de
`backend/src/config/db/migrations/` con la tabla `kysely_migration` y corre solo las que
faltan, en orden. **No hay que ejecutar ningún script a mano**, en PostgreSQL ni en SQL Server.

Si venís de una versión anterior al soporte de varios motores (esquema armado con los `.sql`
de `backend/docs/`), el primer arranque termina de aplicar los `.sql` que falten y pasa solo al
sistema nuevo; ver [Base de datos](/docs/despliegue/base-de-datos#instalaciones-anteriores-postgresql).

```text
git pull  →  docker compose up -d --build  →  el backend aplica lo pendiente
```

Cada migración corre en su propia transacción. Si una falla, hace *rollback* y el backend
aborta el arranque (visible en los logs) en vez de quedar a medias — así el error se nota
y el orquestador reintenta. El seed (`seed.ts`) se aplica en cada arranque de forma
idempotente, con lo que los permisos/settings nuevos llegan solos.

:::note
Si preferís aplicar las migraciones **antes** de levantar la app (o contra una BD
externa), corré `cd backend && npm run migrate`. Se controla con
`RUN_MIGRATIONS_ON_BOOT=false` para desacoplarlo del arranque.
:::

Ver el modelo completo (esquema / migraciones / seed) y cómo autorar una migración nueva
en [Base de datos](/docs/despliegue/base-de-datos).

## Reconstrucción de contenedores

Con Docker Compose:

```bash
docker compose build --no-cache
docker compose up -d
```

Sin Docker (desarrollo o instalación manual):

```bash
cd backend && npm install && npm run dev   # o npm start en producción
cd ../frontend && npm install && npm run build
```

## Versionado y compatibilidad

El proyecto está en fase **alpha** (`v1.0.0-alpha.x`, semver). La versión humana vive en
`backend/package.json` y en los tags de git; la versión **real de la base** es la tabla
`kysely_migration`. Cada release que cambia el esquema incluye su(s) migración(es)
nueva(s), que se aplican solas al actualizar.

Buenas prácticas al mantener versiones:

- Etiquetá cada release (`git tag v1.0.0-alpha.5`) y anotá en el changelog qué migración
  entró en cada versión, por ejemplo:

  ```text
  ## v1.0.0-alpha.5
  - DB: 004_pin_conversations (agrega conversation_members.pinned_at)
  - Feat: fijar conversaciones
  ```

- Como las migraciones son **aditivas** e idempotentes, podés bajar la versión de la *app*
  sin bajar la base: el código viejo tolera columnas nuevas que no usa. Los cambios
  destructivos se hacen en dos pasos (*expand-contract*, ver
  [Base de datos](/docs/despliegue/base-de-datos#agregar-un-cambio-de-esquema-nueva-versión)).
- Revisá siempre los commits/changelog entre tu versión y la nueva antes de actualizar en
  producción, y tené el [backup](/docs/despliegue/backups) hecho.

## Rollback

No hay un mecanismo de rollback automático de migraciones. Para revertir una
actualización problemática:

1. Restaurá el backup de la base de datos y de MinIO tomado antes de actualizar (ver [Backups](/docs/despliegue/backups)).
2. Volvé al commit/tag anterior del código (`git checkout <tag_anterior>`).
3. Reconstruí los contenedores o reinstalá dependencias con esa versión del código.

## Checklist post-actualización

- [ ] `GET /api/health/ready` responde `ready: true`.
- [ ] El [dashboard de monitoreo](/docs/admin/monitoreo) no muestra estado `unhealthy`.
- [ ] Podés iniciar sesión y enviar un mensaje de prueba.
- [ ] La descarga de un adjunto existente funciona (URLs prefirmadas de MinIO).
- [ ] Los jobs cron aparecen como `running` en la pestaña de monitoreo correspondiente.
