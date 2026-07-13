---
title: Spatial Canvas
description: Sistema visual Lienzo Espacial — tokens, layout y componentes flotantes.
---

**Lienzo Espacial** (*Spatial Canvas*) es el sistema visual propio de EchoChat.
Documentación fuente completa: `docs/SPATIAL_CANVAS.md` en el repositorio.

## Filosofía del diseño

Un híbrido entre neobrutalismo y minimalismo orgánico, con tres principios:

1. **El fondo es un escenario, no un color** — gradiente ambiente profundo (casi negro
   con tinte índigo/violeta); las tarjetas flotan con elevación real (sombras de color,
   no negras) y bordes semitransparentes.
2. **Tipografía-first** — nombres de canal y títulos en display grande y reconocible; el
   cuerpo del chat en una fuente optimizada para lectura.
3. **Modelo mental intacto** — servidores → canales → chat (como Discord/Slack); cambia
   la piel, no la usabilidad.

## Tokens de color

Tokens semánticos, dark-first (implementados en `frontend/src/index.css` bajo `@theme`):

| Token | Dark | Light |
|-------|------|-------|
| `bg-canvas` | `#0B0D14` | `#F6F5F1` |
| `bg-panel` | `#151826` @ 80% + blur | `#FFFFFF` |
| `accent` | `#7C5CFF` (violeta eléctrico) | `#6644E8` |
| `accent-energy` | `#3DDC97` (verde menta) | `#0FA968` |
| `text-primary` | `#EDEDF4` | `#1A1A2E` |
| `text-muted` | `#8A8FA8` | `#5C5F73` |
| `danger` | `#FF6B6B` | `#DC2626` |

El violeta se usa para identidad y estados activos — nunca como fondo grande. Contraste
AA 4.5:1 verificado por modo.

## Tipografía

| Rol | Fuente | Uso |
|-----|--------|-----|
| **Display** | Clash Display 500–600 | Nombres de canal, títulos de sección — **nunca** en el cuerpo de un mensaje |
| **UI y chat** | Satoshi, 16px base, `line-height: 1.6` | Interfaz y cuerpo de mensajes (fallback Inter/system-ui) |

Cargadas vía Fontshare CDN en el `<head>` del sitio de documentación y en
`frontend/index.html`.

## Elevaciones y sombras

Tres niveles de elevación (`.echo-e1`/`.echo-e2`/`.echo-e3`) con sombras de color, no
negras. El chat usa elevación 3 (protagonista), el sidebar elevación 2, el dock usa
efecto glass.

## Paneles flotantes

Toda superficie usa la primitiva `<CanvasPanel />` (`frontend/src/components/CanvasPanel.jsx`)
— nunca sombras ad-hoc:

```jsx
<CanvasPanel
  elevation={2}      // 1 | 2 | 3
  glass              // backdrop-blur + opacidad
  radius="xl"        // lg (16px) | xl (24px)
  inset="md"         // margen contra el canvas
  accentGlow         // glow violeta de marca
/>
```

## Orbit dock

`<ServerOrbitDock />` (`frontend/src/components/ServerOrbitDock.jsx`) es el dock lateral
flotante estilo macOS. El ítem activo anima de círculo a squircle con un spring, con glow
del color de marca. En pantallas menores a 1024px se convierte en una barra inferior.

## Composer flotante

`<FloatingComposer />` es el input flotante dentro de la tarjeta de chat (no una barra
pegada al fondo de la pantalla), con anillo de foco y transición de elevación al
enfocarse.

## Tema claro y oscuro

Tres modos (`light`/`dark`/`system`) y siete colores de acento, aplicados vía clase
`dark` y atributo `data-accent` en `<html>`, persistidos en `localStorage`
(`echochat-theme`). Ver [Personalización](/docs/uso/personalizacion) para la
perspectiva de usuario final.

## Referencia en código

| Elemento | Archivo |
|----------|---------|
| Tokens y utilidades CSS | `frontend/src/index.css` |
| `CanvasPanel` | `frontend/src/components/CanvasPanel.jsx` |
| `ServerOrbitDock` | `frontend/src/components/ServerOrbitDock.jsx` |
| `FloatingComposer` | `frontend/src/components/FloatingComposer.jsx` |
| `PresenceAvatarStack` | `frontend/src/components/PresenceAvatarStack.jsx` |
| `CommandPalette` (`Ctrl+K`) | `frontend/src/components/CommandPalette.jsx` |
| Documentación fuente completa | `docs/SPATIAL_CANVAS.md` |
