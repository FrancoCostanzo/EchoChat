---
title: Emojis, stickers y GIFs
description: Selector de emojis, stickers personalizados y GIFs en el composer.
---

## Selector de emojis

El botón de emoji del composer abre un selector completo (categorías, búsqueda y tonos
de piel) con la librería open source [emoji-mart](https://github.com/missive/emoji-mart).
Usa el set de emoji **nativo** del sistema operativo, así que no descarga imágenes: elegir
un emoji simplemente lo inserta como texto en el mensaje.

## Stickers personalizados

A diferencia de los emojis, los **stickers** son imágenes que cada usuario sube y arma
como su propia colección personal — al estilo de los stickers de WhatsApp.

- Abrí el selector de stickers/GIFs (junto al de emoji) y elegí la pestaña **Stickers**.
- Tocá **Agregar** para subir una imagen (formatos de imagen estándar, máximo 2 MB). Se
  guarda en tu almacenamiento (ver [Almacenamiento](/docs/despliegue/almacenamiento)) y
  queda disponible en tu colección para futuros envíos.
- Tocá cualquier sticker de tu colección para enviarlo de inmediato a la conversación
  activa — se envía sin bubble de texto, como una imagen suelta.
- **Editar** activa el modo de gestión, donde podés eliminar stickers de tu colección
  tocándolos.

Cada usuario tiene su propia colección; no hay packs de stickers compartidos ni
moderación central por ahora.

## GIFs

La pestaña **GIFs** busca animaciones en [Giphy](https://giphy.com) y las envía igual que
un sticker (sin volver a subirlas: se referencia la URL del proveedor). Requiere que el
despliegue tenga configurada una clave gratuita de Giphy
(`VITE_GIPHY_API_KEY`, ver [Variables de entorno](/docs/despliegue/variables-entorno)); si
no está configurada, la pestaña muestra un aviso con el enlace para generarla en lugar de
fallar en silencio. Los stickers personalizados funcionan siempre, sin esa clave.

## Respuestas y vista previa

Los mensajes de sticker/GIF se pueden citar igual que cualquier otro mensaje: la vista
previa de respuesta muestra un ícono y la etiqueta "Sticker" o "GIF" en lugar del texto.
En la lista de conversaciones, el último mensaje de tipo sticker/GIF también se muestra
con su ícono correspondiente en vez de un texto vacío.
