---
title: Backups
description: Estrategias de backup y restore de PostgreSQL y MinIO.
---

EchoChat no incluye una herramienta de backup propia: usá las herramientas estándar de
PostgreSQL y de MinIO/S3.

## Qué respaldar

- **PostgreSQL**: toda la base `echochat` (mensajes, usuarios, roles, configuración,
  auditoría, referencias a archivos).
- **MinIO**: todos los buckets `messaging-*` (avatares, imágenes, videos, audio,
  documentos, grabaciones, stickers).
- **La clave `MESSAGE_ENC_KEY`**: es imprescindible guardarla junto con el backup de la
  base de datos. Sin ella, los mensajes cifrados en reposo son irrecuperables aunque
  restaures la base correctamente.

:::caution
No hace falta (ni conviene) respaldar `storage_presigned_urls`: son URLs temporales que
se regeneran solas.
:::

## Backup de PostgreSQL

```bash
pg_dump -U echochat -d echochat -F c -f echochat_$(date +%Y%m%d).dump
```

Con Docker, ejecutalo dentro del contenedor o contra el puerto expuesto de PostgreSQL:

```bash
docker compose exec postgres pg_dump -U echochat -d echochat -F c -f /tmp/echochat.dump
docker compose cp postgres:/tmp/echochat.dump ./echochat_$(date +%Y%m%d).dump
```

## Backup de MinIO

Usá el cliente `mc` (MinIO Client) para espejar los buckets a otro almacenamiento:

```bash
mc alias set echochat http://IP_DEL_SERVIDOR:9000 ACCESS_KEY SECRET_KEY
mc mirror echochat/messaging-images ./backup/messaging-images
mc mirror echochat/messaging-documents ./backup/messaging-documents
# Repetir por cada bucket messaging-*
```

O respaldá directamente el volumen de datos de MinIO si corre en Docker.

## Restore de PostgreSQL

```bash
pg_restore -U echochat -d echochat --clean --if-exists echochat_20260101.dump
```

## Restore de MinIO

```bash
mc mirror ./backup/messaging-images echochat/messaging-images
```

Los buckets se recrean automáticamente al iniciar el backend si no existen (ver
[Almacenamiento](/docs/despliegue/almacenamiento)), así que solo necesitás restaurar el
contenido.

## Automatización

No hay un job integrado de backup automático. Se recomienda programar `pg_dump` y
`mc mirror` con `cron` (o el scheduler del sistema operativo) en un servidor separado del
que corre EchoChat, con retención y rotación según la política de la organización.

## Pruebas de recuperación

Probá el proceso de restore periódicamente en un entorno aislado (no en producción):
restaurá el dump de PostgreSQL y los buckets de MinIO en una instancia de prueba,
levantá el backend apuntando a esa copia y verificá que el login, los mensajes y la
descarga de adjuntos funcionen correctamente.
