---
title: App de escritorio
description: Cliente nativo para Windows, macOS y Linux — descarga, primer arranque y funciones.
---

Cliente de escritorio con Electron para Windows, macOS y Linux. No es un servidor aparte:
es sólo la interfaz, igual que la web, apuntando al servidor EchoChat que ya tenés
desplegado (self-hosted).

## Descargar

Instaladores en [GitHub Releases](https://github.com/FrancoCostanzo/EchoChat/releases/latest):

| SO | Archivo |
|----|---------|
| Windows | `EchoChat Setup x.y.z.exe` (instalador) o `EchoChat x.y.z.exe` (portable, sin instalar) |
| macOS | `EchoChat-x.y.z.dmg` (Intel y Apple Silicon) |
| Linux | `EchoChat-x.y.z.AppImage` o el `.deb` |

:::caution[Sin firma de código]
Los instaladores todavía no están firmados. Windows va a mostrar la advertencia de
SmartScreen ("Más información" → "Ejecutar de todas formas") y macOS pide abrir el DMG con
clic derecho → Abrir la primera vez. En macOS, además, la auto-actualización no funciona
sin firma — hay que bajar la versión nueva a mano.
:::

## Primer arranque

Al abrir la app por primera vez pide la dirección del servidor EchoChat de tu
organización (por ejemplo `chat.miempresa.com`) — es la misma URL que usarías en el
navegador. Se puede cambiar después desde el ícono de la bandeja del sistema
("Cambiar de servidor").

## Qué suma sobre la web

- **Bandeja del sistema**: cerrar la ventana la oculta, la app sigue recibiendo mensajes.
- **Notificaciones nativas del SO**, con contador de no leídos en el ícono/dock.
- **Arranque con el sistema** (configurable desde la bandeja).
- **Deep links** (`echochat://`) para volver a la app después del login SSO en el navegador.
- **Auto-actualización** en segundo plano contra GitHub Releases (salvo macOS sin firma).
- **Sesión cifrada** con el llavero del sistema operativo (Credential Manager en Windows,
  Keychain en macOS, libsecret en Linux) en vez de en un archivo sin cifrar.

El resto — mensajería, llamadas, canales, difusiones — es exactamente lo mismo que en la
web: comparten el mismo frontend.

## Compartir pantalla en llamadas

Al compartir pantalla en una llamada, la app muestra un selector propio de pantalla o
ventana (Electron no puede usar el selector nativo del navegador). En macOS, la primera
vez pide el permiso de Grabación de pantalla desde Preferencias del Sistema.
