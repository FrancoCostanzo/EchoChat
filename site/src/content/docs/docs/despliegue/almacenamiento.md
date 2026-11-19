---
title: Almacenamiento
description: Dónde guarda EchoChat los archivos — MinIO, AWS S3, R2 u otro S3 compatible, o el disco del servidor.
---

## Dónde se guardan los archivos

Avatares, adjuntos, stickers, wallpapers y grabaciones se guardan según `STORAGE_DRIVER`:

| `STORAGE_DRIVER` | Dónde | Cuándo usarlo |
|------------------|-------|---------------|
| `s3` (por defecto) | Cualquier servicio compatible con S3: **MinIO**, **AWS S3**, **Cloudflare R2**, Wasabi, Backblaze B2, Garage, SeaweedFS… | Producción, varias instancias del backend |
| `local` | Una carpeta del disco del servidor | Desarrollo sin Docker o una instalación chica de un solo servidor |

El resto de la app no distingue entre los dos: en ambos casos los archivos se descargan con
**URLs firmadas** que vencen (ver más abajo).

## Buckets

EchoChat organiza los archivos en buckets separados por tipo. Con `s3` son buckets del
proveedor; con `local`, subcarpetas.

| Bucket | Contenido |
|--------|-----------|
| `messaging-avatars` | Fotos de perfil |
| `messaging-images` | Imágenes enviadas en mensajes |
| `messaging-videos` | Videos enviados en mensajes |
| `messaging-audio` | Archivos de audio |
| `messaging-documents` | Documentos (PDF, DOC, etc.) |
| `messaging-thumbnails` | Miniaturas auto-generadas (planificado, ver [Estado del proyecto](/docs/estado)) |
| `messaging-recordings` | Grabaciones de llamadas |
| `messaging-stickers` | Stickers personalizados subidos por cada usuario |
| `messaging-wallpapers` | Fondos de chat subidos por cada usuario |

Se crean automáticamente al iniciar el backend si no existen — no requiere intervención
manual, ni en desarrollo ni en Docker.

**Prefijo de buckets** (`STORAGE_BUCKET_PREFIX`): se antepone al nombre físico de cada bucket.
En AWS los nombres de bucket son **globales** (`messaging-images` seguramente ya existe), así
que conviene uno propio, por ejemplo `miempresa-echochat-`. En la base de datos se guardan
siempre los nombres sin prefijo, así que se puede cambiar sin migrar datos (pero hay que mover
los objetos al bucket nuevo).

## Proveedores S3

Las variables se pueden escribir como `S3_*` o con el nombre histórico `MINIO_*`
(`S3_ENDPOINT` o `MINIO_ENDPOINT`, etc.); si están las dos, gana `S3_*`. Ver la lista
completa en [Variables de entorno](/docs/despliegue/variables-entorno#almacenamiento).

**MinIO integrado** (perfil `minio` de Docker Compose):

```env
MINIO_ENDPOINT=minio
MINIO_PUBLIC_ENDPOINT=192.168.1.100   # IP o dominio con el que el navegador llega a MinIO
```

**MinIO u otro S3 externo** de la organización: apuntar `MINIO_ENDPOINT` al host
correspondiente y dejar el perfil `minio` desactivado.

**AWS S3:**

```env
S3_ENDPOINT=s3.us-east-1.amazonaws.com
S3_PORT=443
S3_USE_SSL=true
S3_REGION=us-east-1
S3_PATH_STYLE=false              # AWS usa bucket.host/clave
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
STORAGE_BUCKET_PREFIX=miempresa-echochat-
```

**Cloudflare R2:**

```env
S3_ENDPOINT=<cuenta>.r2.cloudflarestorage.com
S3_PORT=443
S3_USE_SSL=true
S3_REGION=auto
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Ver combinaciones completas de Docker en [Despliegue con Docker](/docs/despliegue).

### Endpoint público

`S3_PUBLIC_ENDPOINT` (o `MINIO_PUBLIC_ENDPOINT`, más `_PORT` / `_USE_SSL`) define cómo el
**navegador** del usuario llega al almacenamiento para descargar archivos — que puede ser
distinto de cómo el backend se conecta internamente. En un despliegue todo-en-uno,
normalmente es la IP o dominio público del servidor; en desarrollo, `localhost`. Si no se
configura, se usa el endpoint interno.

### Consola de administración

Con el MinIO integrado, la consola web queda disponible en
`http://IP_DEL_SERVIDOR:9001` (puerto configurable con `MINIO_CONSOLE_PORT`), con las
credenciales de `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`.

## Almacenamiento local

```env
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/var/lib/echochat/storage   # por defecto, backend/storage-data
STORAGE_PUBLIC_URL=https://chat.miempresa.com # origen con el que el navegador llega al backend
```

- Los archivos los sirve el propio backend en `/api/storage/files/…`, con URLs firmadas
  (HMAC y vencimiento) igual que las de S3. La firma usa `STORAGE_LOCAL_SECRET` o, si no
  está, una clave derivada de `JWT_SECRET`.
- `STORAGE_PUBLIC_URL` vacío deja las URLs relativas: sirve si la web y la API comparten
  dominio (o con el proxy de Vite en desarrollo). La **app de escritorio** necesita un
  origen absoluto.
- Los HTML, SVG y otros tipos que el navegador podría ejecutar se entregan como descarga y
  con `Content-Security-Policy: sandbox`, para que no corran en el dominio de la API.

:::caution
El driver local sirve para **una sola instancia** del backend (o varias con la carpeta
compartida por NFS o un volumen). En Docker hay que montar un volumen en
`STORAGE_LOCAL_DIR`; si no, los archivos se pierden al recrear el contenedor.
:::

## URLs firmadas

Los archivos no son públicos: cada descarga usa una **URL firmada** con vencimiento,
generada bajo demanda y cacheada en la tabla `storage_presigned_urls`. Un job en el
backend (`presigned-cleanup`, cada 15 minutos) elimina de esa caché las que vencieron.

## Límites y políticas

- Subida de avatar: máximo 5 MB, formatos `jpeg`/`png`/`webp`/`gif`.
- Subida de sticker personalizado: máximo 2 MB, solo imágenes (validado en el frontend).
- Subida general de archivos (`/api/storage/upload`): máximo 500 MB, requiere el permiso
  `media.upload`.
- No hay, todavía, deduplicación por hash, escaneo antivirus ni límites de cuota por
  usuario/departamento (ver [Estado del proyecto](/docs/estado)).

## GIFs (Giphy)

Los GIFs enviados desde el selector de stickers/GIFs (ver
[Emojis, stickers y GIFs](/docs/uso/stickers-y-gifs)) **no se suben al almacenamiento**: el
mensaje solo referencia la URL del CDN de Giphy. Requieren `VITE_GIPHY_API_KEY` configurada
en el frontend (ver [Variables de entorno](/docs/despliegue/variables-entorno)).
