---
title: Mensajería
description: Envío, edición, reacciones, hilos, búsqueda y funciones avanzadas de mensajes.
---

## Enviar mensajes

Escribí en el composer y presioná `Enter` para enviar (`Shift+Enter` agrega una línea
nueva sin enviar). Podés escribir texto plano o [formato enriquecido](/docs/uso/formato)
con markdown. Si el envío falla (por ejemplo, sin conexión), el mensaje queda marcado con
un ícono de error y podés reintentarlo desde el mismo mensaje.

## Edición e historial

Solo podés editar tus propios mensajes (desde el menú contextual → **Editar**). Cada
edición queda registrada; el mensaje muestra una marca "editado" y conserva su formato
(`body_format`).

## Reacciones

Abrí el menú contextual de un mensaje (clic derecho o mantener presionado en táctil) y
elegí una reacción rápida, o agregá cualquier emoji. Las reacciones se muestran como
pastillas debajo del mensaje con el conteo; tocar una pastilla que ya elegiste la quita.

## Respuestas en hilo (threads)

Elegí **Responder en hilo** en el menú de un mensaje para abrir el panel de hilo. Las
respuestas de un hilo no aparecen en la línea de tiempo principal de la conversación; el
mensaje raíz muestra un contador de respuestas que se actualiza en tiempo real para
todos los participantes.

## Reenvío

Elegí **Reenviar** en el menú de un mensaje para copiarlo a una o varias conversaciones
a la vez. El mensaje reenviado conserva el contenido y los adjuntos originales sin
volver a subir los archivos.

## Mensajes fijados

Los mensajes importantes se pueden **fijar** desde el menú contextual o el encabezado de
la conversación. El panel de fijados lista todos los mensajes fijados de esa
conversación y permite saltar directamente a cada uno o desfijarlo.

## Mensajes guardados

**Guardar** un mensaje lo agrega a tu colección personal de guardados
(`/saved`), visible solo para vos, independientemente de la conversación de origen. Útil
para marcar información que querés encontrar rápido después.

## Borradores

El texto que estás escribiendo en el composer se guarda automáticamente como borrador
por conversación (con una pequeña demora tras dejar de tipear). Si cambiás de
conversación y volvés, tu borrador sigue ahí; se borra automáticamente al enviar el
mensaje.

## Búsqueda full-text

El panel de búsqueda (dentro de cada conversación) busca en el contenido de los mensajes
con resaltado de coincidencias y salto directo al mensaje encontrado en el timeline.

## Recibos de lectura y entrega

Cada mensaje propio muestra su estado: enviando, error, enviado, entregado o leído (doble
check). Tocar el ícono de recibo (o **Info del mensaje** en el menú) abre el detalle con
quién recibió y quién leyó el mensaje, y cuándo.

## Indicadores de escritura

Cuando alguien está escribiendo en una conversación, el resto de los participantes ve un
indicador "escribiendo…" en tiempo real (vía Socket.IO), sin necesidad de recargar.

## Adjuntos

Podés adjuntar imágenes, videos, audio y documentos arrastrándolos al chat, pegándolos
(`Ctrl+V`) o desde el selector de archivos del composer. Las imágenes y videos tienen
vista previa antes de enviar; los archivos se almacenan en MinIO y se sirven mediante
URLs prefirmadas (ver [Almacenamiento](/docs/despliegue/almacenamiento)).
