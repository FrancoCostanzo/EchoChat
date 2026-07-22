---
title: Formato enriquecido
description: Markdown, barra de formato inline y bloques de código en mensajes.
---

## Texto plano vs markdown

Si escribís texto simple, se envía como **texto plano**. Si usás sintaxis markdown
(negrita, cursiva, listas, etc.), EchoChat lo detecta automáticamente y lo envía como
**markdown**, renderizado con formato en la burbuja de todos los destinatarios. Esto es
retrocompatible: los mensajes viejos en texto plano siguen viéndose igual.

## Barra de formato

El composer incluye una barra de formato con botones para **negrita**, *cursiva*,
~~tachado~~ y `código inline`. Seleccioná texto y tocá un botón (o usá el atajo) para
envolver la selección con la sintaxis correspondiente.

## Atajos de teclado

| Formato | Sintaxis | Atajo |
|---------|----------|-------|
| Negrita | `**texto**` | `Ctrl` / `Cmd` + `B` |
| Cursiva | `*texto*` | `Ctrl` / `Cmd` + `I` |
| Tachado | `~~texto~~` | — |
| Código inline | `` `código` `` | `Ctrl` / `Cmd` + `E` |

También soporta listas, citas (`>`) y enlaces en formato markdown estándar (GFM).

## Bloques de código

Para compartir un snippet completo (no solo una palabra en código inline), usá la opción
**Enviar como código** del menú de adjuntar. Elegís el lenguaje, escribís o pegás el
snippet, y se envía como un mensaje dedicado con resaltado de sintaxis y un botón para
copiarlo al portapapeles. Si pegás un bloque delimitado con triple backtick
(` ```lenguaje `), EchoChat te sugiere pasar automáticamente a este modo.

## Vista previa

El renderizado de markdown se aplica igual en la conversación principal, en los hilos y
en tus mensajes guardados — lo que ves al escribir es lo que van a ver los demás.

## Edición de mensajes formateados

Al editar un mensaje se conserva su `body_format` original (plano o markdown), así que
podés seguir usando la barra de formato normalmente sobre un mensaje ya enviado. La
edición solo está disponible dentro de la
[ventana de tiempo](/docs/uso/mensajeria#edición-e-historial) configurada (15 minutos por
defecto).

## Limitaciones de seguridad

Por seguridad, el markdown **no permite HTML embebido** — solo se interpreta la sintaxis
estándar (negrita, cursiva, tachado, código, listas, citas, enlaces). Esto evita que un
mensaje pueda inyectar contenido arbitrario en la interfaz de otros usuarios.
