---
title: Actualización
description: Procedimiento para actualizar EchoChat y aplicar migraciones.
---

## Flujo de actualización

1. Hacé un [backup](/docs/despliegue/backups) de PostgreSQL y MinIO antes de actualizar.
2. Traé el código nuevo:

   ```bash
   git pull origin main
   ```

3. Revisá si hay migraciones nuevas en `backend/docs/migrations/` desde tu última
   actualización (ver siguiente sección).
4. Reconstruí y reiniciá (ver [Reconstrucción de contenedores](#reconstrucción-de-contenedores)).
5. Verificá `GET /api/health/ready` antes de considerar la actualización completa.

## Migraciones de base de datos

EchoChat no tiene un runner de migraciones automático: **aplicá manualmente** cualquier
archivo nuevo en `backend/docs/migrations/` que no hayas corrido todavía, en orden
numérico:

```bash
psql -U echochat -d echochat -f backend/docs/migrations/00X_nombre.sql
```

Todas las migraciones son idempotentes, así que no hay riesgo grave en volver a correr
una que ya se aplicó. Ver el detalle de cada una en [Base de datos](/docs/despliegue/base-de-datos#migraciones).

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

## Compatibilidad de versiones

El proyecto está en fase **alpha** (`v1.0.0-alpha.x`): puede haber cambios de esquema de
base de datos entre versiones que requieran una migración específica. Revisá siempre el
changelog/commits entre tu versión actual y la nueva antes de actualizar en producción.

## Rollback

No hay un mecanismo de rollback automático de migraciones. Para revertir una
actualización problemática:

1. Restaurá el backup de PostgreSQL y MinIO tomado antes de actualizar (ver [Backups](/docs/despliegue/backups)).
2. Volvé al commit/tag anterior del código (`git checkout <tag_anterior>`).
3. Reconstruí los contenedores o reinstalá dependencias con esa versión del código.

## Checklist post-actualización

- [ ] `GET /api/health/ready` responde `ready: true`.
- [ ] El [dashboard de monitoreo](/docs/admin/monitoreo) no muestra estado `unhealthy`.
- [ ] Podés iniciar sesión y enviar un mensaje de prueba.
- [ ] La descarga de un adjunto existente funciona (URLs prefirmadas de MinIO).
- [ ] Los jobs cron aparecen como `running` en la pestaña de monitoreo correspondiente.
