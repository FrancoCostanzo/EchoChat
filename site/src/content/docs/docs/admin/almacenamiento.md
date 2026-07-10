---
title: Almacenamiento (admin)
description: Dashboard de storage MinIO, objetos y estadísticas.
---

Requiere el permiso `admin.storage`.

## Vista general de storage

Desde **Administración → Almacenamiento** (`/admin/storage`) se ve un resumen agregado
de todo lo subido a MinIO: cantidad total de objetos, tamaño total y objetos con estado
pendiente o fallido.

## Estadísticas por bucket

El desglose muestra cantidad de objetos y tamaño ocupado por cada bucket
(`messaging-avatars`, `messaging-images`, `messaging-videos`, `messaging-audio`,
`messaging-documents`, `messaging-recordings`, `messaging-stickers`), útil para entender
qué tipo de contenido consume más espacio.

## Objetos recientes

Una tabla lista los archivos subidos más recientemente (`storage_objects`), con su
`processing_status` y bucket de destino.

## Estados de procesamiento

Cada objeto subido tiene un `processing_status`: `pending`, `processing`, `completed` o
`failed`. Hoy la mayoría de los archivos quedan como `completed` directamente al subir;
los estados `pending`/`processing` están preparados para el futuro pipeline de
thumbnails/antivirus (ver [Estado del proyecto](/docs/estado)).

## Cuota y uso

No hay, por ahora, límites de cuota configurables por usuario o departamento — solo los
límites de tamaño por archivo definidos en [Configuración del sistema](/docs/admin/sistema#categorías-de-configuración)
(`max_image_size_mb`, `max_video_size_mb`, etc.).

## Objetos fallidos

Los objetos con `processing_status = failed` se destacan en el dashboard para
identificar subidas problemáticas.

## Acciones de mantenimiento

El panel es de solo lectura sobre MinIO (estadísticas y listado); para borrar objetos
puntualmente o gestionar buckets a bajo nivel, usá la consola web de MinIO
(ver [Almacenamiento — despliegue](/docs/despliegue/almacenamiento#consola-de-administración)).
