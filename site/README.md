# EchoChat — Sitio (portfolio + documentación)

Sitio de presentación y documentación de [EchoChat](../README.md), construido con
[Astro](https://astro.build) y [Starlight](https://starlight.astro.build).

- `/` — página de portfolio (hero, features, plataformas, stack).
- `/faq` — preguntas frecuentes.
- `/docs/*` — documentación (gestionada por Starlight).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
```

## Build

```bash
npm run build    # genera site/dist
npm run preview  # sirve el build localmente
```

## Despliegue (Netlify)

El deploy se configura desde `netlify.toml` en la raíz del repositorio
(`base = "site"`, `publish = "dist"`). Cada push al repo redespliega el sitio.

## Estructura

```
site/
├─ src/
│  ├─ layouts/PortfolioLayout.astro   # layout de / y /faq
│  ├─ pages/
│  │  ├─ index.astro                  # portfolio
│  │  └─ faq.astro                    # FAQ
│  ├─ content/docs/docs/*.md          # documentación (URLs /docs/*)
│  └─ styles/                         # site.css (portfolio) + starlight.css (docs)
└─ astro.config.mjs
```

> Antes de publicar, ajustá `SITE_URL` y `REPO_URL` en `astro.config.mjs` (y las URLs de
> GitHub en los componentes) con el dominio y repositorio reales.
