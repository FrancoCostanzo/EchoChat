# Lienzo Espacial — Sistema de diseño EchoChat

> **Estado:** en implementación (rama `feat/quick-wins`)  
> **Referencia técnica:** `frontend/src/index.css` (tokens `@theme`), `frontend/src/components/CanvasPanel.jsx`

## 1. Concepto visual

Híbrido entre neobrutalismo y minimalismo orgánico: **Lienzo Espacial** (*Spatial Canvas*).

| Descartado | Motivo |
|------------|--------|
| Neobrutalismo puro | Agresivo en uso prolongado; saturado en portfolios 2026 |
| Orgánico minimalista | Poco memorable en producto denso en información |

### Principios

1. **El fondo es un escenario, no un color** — gradiente ambiente profundo (casi negro con tinte índigo/violeta, animado sutilmente). Las tarjetas flotan con elevación real: sombras de **color** (no negras), bordes 1px semitransparentes y glass en superficies secundarias.
2. **Tipografía-first** — nombres de servidor/canal en display grande y característico; chat en fuente optimizada para lectura. El contraste tipográfico hace reconocible una captura al instante.
3. **Model mental intacto** — servidores → canales → chat (como Discord/Slack). Cambia la piel y la composición, no la usabilidad.

## 2. Paleta y tipografía

### Tipografía (Fontshare, licencia comercial)

| Rol | Fuente | Uso |
|-----|--------|-----|
| **Display** | Clash Display 500–600, `-0.02em` tracking | Nombres de servidor, títulos de canal, headers de sección |
| **UI y chat** | Satoshi 16px base, `line-height: 1.6` | Interfaz y cuerpo de mensajes. Fallback: Inter, system-ui |

**Regla de oro:** Clash Display **nunca** en el cuerpo de un mensaje. Solo jerarquía.

Carga en `frontend/index.html` vía Fontshare CDN.

### Tokens semánticos (dark-first)

| Token | Dark (primario) | Light |
|-------|-----------------|-------|
| `bg-canvas` | `#0B0D14` (índigo-negro) | `#F6F5F1` (papel cálido) |
| `bg-panel` | `#151826` @ 80% + blur | `#FFFFFF` |
| `accent` (marca) | `#7C5CFF` violeta eléctrico | `#6644E8` |
| `accent-energy` (CTAs, presencia) | `#3DDC97` verde menta | `#0FA968` |
| `text-primary` | `#EDEDF4` | `#1A1A2E` |
| `text-muted` | `#8A8FA8` | `#5C5F73` |
| `danger` | `#FF6B6B` | `#DC2626` |

### Anti-fatiga visual

- Violeta = identidad y estados activos, **nunca** fondos grandes.
- Fondos neutros profundos; el color llega como acento y glow ambiental.
- Sombra de acento de referencia: `0 8px 32px rgb(124 92 255 / 0.15)`.
- Light mode: papel cálido evita blanco quirúrgico.
- **Contraste AA 4.5:1** verificado por modo por separado.

Implementación CSS: variables `--echo-bg-canvas`, `--echo-bg-panel`, etc. en `index.css`.

## 3. Layout: Dock + Lienzo

```
┌─────────────────────────────────────────────────────────────┐
│  canvas (gradiente ambiente, aire visible entre paneles)    │
│  ┌──┐  ┌──────────┐  ┌────────────────────┐  ┌─┐         │
│  │D │  │ canales  │  │       chat         │  │●│ avatars  │
│  │o │  │ (tarjeta │  │   (tarjeta hero,   │  │●│ rail     │
│  │c │  │ flotante)│  │   elevation 3)     │  │●│          │
│  │k │  └──────────┘  └────────────────────┘  └─┘         │
│  └──┘                                                        │
└─────────────────────────────────────────────────────────────┘
```

| Zona | Comportamiento |
|------|----------------|
| **Dock de servidores** | Vertical flotante (estilo macOS), separado del borde. Activo → squircle + glow del color de marca. |
| **Panel de canales** | Tarjeta flotante con elevación propia; no llega al techo ni al piso. Nombre en Clash Display ~24px. Colapsable con `Ctrl+\`. |
| **Chat** | Tarjeta protagonista: más grande, más elevada, radio 20–24px. El canvas se ve **entre** paneles. |
| **Miembros** | Rail estrecho de avatares; panel flotante superpuesto al clic (~240px recuperados). |
| **Command palette** | `Ctrl+K` — navegación primaria power users. |
| **Acciones de mensaje** | Menú contextual (clic derecho / long-press), sin iconos hover flotantes. |
| **Responsive `<1024px`** | Dock → bottom-bar; paneles → sheets; conservar radio y elevación. |

## 4. Componentes React

Stack: **Tailwind 4** + **HeroUI / Radix** + **Framer Motion**.

| Componente | Estado | Archivo |
|------------|--------|---------|
| `<CanvasPanel />` | ✅ | `components/CanvasPanel.jsx` |
| `<CommandPalette />` | ✅ | `components/CommandPalette.jsx` |
| `<ServerOrbitDock />` | ✅ | `components/ServerOrbitDock.jsx` (`GuildRail` re-export) |
| `<FloatingComposer />` | ✅ | `components/FloatingComposer.jsx` |
| `<PresenceAvatarStack />` | ✅ | `components/PresenceAvatarStack.jsx` |

### `<CanvasPanel />`

Primitiva de superficie. Canales, chat y miembros son instancias.

```jsx
<CanvasPanel
  elevation={2}      // 1 | 2 | 3 → escala de sombras de color
  glass              // backdrop-blur + opacidad
  radius="xl"        // lg (16px) | xl (24px)
  inset="md"         // margen contra el canvas (el aire es parte del API)
  accentGlow         // glow violeta de marca
/>
```

### `<ServerOrbitDock />` (objetivo)

```jsx
<ServerOrbitDock
  servers={[]}
  activeId=""
  glowColor=""           // derivado del servidor activo
  orientation="vertical" // | 'bottom'
  expandedShape="squircle"
/>
```

Orb activo: animación círculo → squircle con spring (`layoutId`).

### `<FloatingComposer />` (objetivo)

Input flotante dentro de la tarjeta de chat (no barra pegada al fondo).

- `channelAccent` — ring de focus del color del canal
- `elevationOnFocus` — sube de elevation 1 → 2 al enfocar (200ms)
- `slashCommandMenu` — Popover anclado

## 5. Checklist pre-implementación

- [ ] Contraste AA en dark y light por separado
- [ ] `prefers-reduced-motion`: desactivar glows animados y springs
- [ ] Focus rings visibles (violeta `--echo-accent`)
- [ ] Targets táctiles ≥ 44px
- [ ] Lista de mensajes virtualizada desde el día uno (50+ ítems)

## 6. Roadmap de implementación

1. ✅ Tokens `@theme` + utilidades `.echo-e1/e2/e3`, `.echo-glass`, `.echo-display`
2. ✅ `<CanvasPanel />` + `<ServerOrbitDock />` + `Ctrl+K`
3. ✅ Sidebar y chat con `<CanvasPanel />` + `inset`; `Ctrl+\` colapsa canales
4. ✅ `<FloatingComposer />` en `ConversationPage`
5. ✅ `<PresenceAvatarStack />` + panel miembros bajo demanda
6. ✅ `<ServerOrbitDock />` con spring squircle + dock inferior `<1024px`
7. 📋 Virtualización de lista de mensajes (50+ ítems)
8. 📋 Sheets móviles para sidebar en rutas secundarias

## Referencias

- `docs/STYLE_GUIDE.md` — convenciones de código frontend
- `AGENTS.md` — instrucciones para Cursor Agent
- [Fontshare — Clash Display & Satoshi](https://www.fontshare.com/)
