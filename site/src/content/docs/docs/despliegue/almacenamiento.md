---
title: Almacenamiento
description: Configuración de MinIO, buckets y almacenamiento S3-compatible.
---

## Buckets de MinIO

EchoChat organiza los archivos en buckets separados por tipo:

| Bucket | Contenido |
|--------|-----------|
| `messaging-avatars` | Fotos de perfil |
| `messaging-images` | Imágenes enviadas en mensajes |
| `messaging-videos` | Videos enviados en mensajes |
| `messaging-audio` | Archivos de audio |
| `messaging-documents` | Documentos (PDF, DOC, etc.) |
| `messaging-thumbnails` | Miniaturas auto-generadas (planificado, ver [Estado del proyecto](/docs/estado)) |
| `messaging-recordings` | Grabaciones de llamadas |
| `messaging-stickers` | Paquetes de stickers |

## Creación automática de buckets

Los buckets se crean automáticamente al iniciar el backend si no existen — no requiere
intervención manual, ni en desarrollo ni en Docker.

## URLs prefirmadas

Los archivos no son públicos: cada descarga usa una **URL prefirmada** con expiración,
generada bajo demanda y cacheada en la tabla `storage_presigned_urls`. Un job en el
backend (`presigned-cleanup`, cada 15 minutos) elimina las URLs prefirmadas expiradas de
esa caché.

## MinIO integrado vs externo

- **Integrado** (perfil `minio` de Docker Compose): usar `MINIO_ENDPOINT=minio`.
- **Externo** (servidor MinIO/S3 ya existente en la organización): apuntar
  `MINIO_ENDPOINT` al host correspondiente y dejar el perfil `minio` desactivado.

Ver combinaciones completas en [Despliegue con Docker](/docs/despliegue).

## Consola de administración

Con el MinIO integrado, la consola web queda disponible en
`http://IP_DEL_SERVIDOR:9001` (puerto configurable con `MINIO_CONSOLE_PORT`), con las
credenciales de `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`.

## Endpoint público

`MINIO_PUBLIC_ENDPOINT` (y `_PORT` / `_USE_SSL`) define cómo el **navegador** del usuario
accede a MinIO para descargar archivos — que puede ser distinto de cómo el backend se
conecta internamente. En un despliegue todo-en-uno, normalmente es la IP o dominio
público del servidor; en desarrollo, `localhost`. Si no se configura, se usa
`MINIO_ENDPOINT` como fallback.

## Límites y políticas

- Subida de avatar: máximo 5 MB, formatos `jpeg`/`png`/`webp`/`gif`.
- Subida general de archivos (`/api/storage/upload`): máximo 500 MB, requiere el permiso
  `media.upload`.
- No hay, todavía, deduplicación por hash, escaneo antivirus ni límites de cuota por
  usuario/departamento (ver [Estado del proyecto](/docs/estado)).
