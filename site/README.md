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

El resultado del build (`site/dist/`) es **HTML/CSS/JS estático puro**: no necesita
Node.js ni backend para servirse. Cualquier hosting estático o servidor web sirve.

## Configuración previa al deploy

En [`astro.config.mjs`](./astro.config.mjs):

- **`SITE_URL`** — la URL pública real del sitio. Se usa para canonicals, sitemap
  y metadatos Open Graph; si no coincide con el dominio, esos links salen mal.
  Sobrescribible sin tocar código con la variable de entorno `ASTRO_SITE`.
- **`ASTRO_BASE`** (variable de entorno) — subruta del deploy si el sitio no
  vive en la raíz del dominio (p.ej. `/EchoChat` en GitHub Pages).
- **`REPO_URL`** — el repositorio de GitHub que enlazan el header y los botones.

## Despliegue

Parámetros comunes a cualquier plataforma:

| Parámetro          | Valor           |
| ------------------ | --------------- |
| Directorio base    | `site`          |
| Comando de build   | `npm run build` |
| Directorio publish | `dist`          |
| Versión de Node    | 18 o superior   |

### Netlify

Ya está configurado: [`netlify.toml`](../netlify.toml) en la raíz del repo define
`base = "site"` y `publish = "dist"`. Cada push redespliega solo. (Ese archivo solo
lo lee Netlify; no afecta a otras plataformas.)

### Vercel / Cloudflare Pages

Crear el proyecto apuntando al repo y usar los parámetros de la tabla
(en Vercel: *Root Directory* = `site`; en Cloudflare: *Build output* = `dist`).
Ambos detectan Astro automáticamente.

### GitHub Pages

Ya está configurado en
[`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml):
en cada push a `main` que toque `site/` se buildea y publica en
`https://francocostanzo.github.io/EchoChat/` (también se puede lanzar a mano
desde la pestaña *Actions*). El workflow pasa `ASTRO_SITE` y `ASTRO_BASE`
al build porque el sitio queda bajo la subruta `/EchoChat` — los links
internos ya usan ese prefijo vía `import.meta.env.BASE_URL`.

Requiere habilitarlo **una sola vez** en el repo:
*Settings → Pages → Build and deployment → Source: "GitHub Actions"*.

Con dominio propio, cambiar `ASTRO_SITE` y quitar `ASTRO_BASE` del workflow.

### Servidor propio (nginx, Apache, Docker…)

Compilar y copiar `site/dist/` al directorio que sirva el servidor:

```bash
cd site && npm ci && npm run build
# ejemplo con nginx:
cp -r dist/* /var/www/echochat-site/
```

```nginx
server {
    listen 80;
    server_name echochat.example.com;
    root /var/www/echochat-site;
    index index.html;
    # URLs limpias de Astro (/docs → /docs/index.html)
    location / {
        try_files $uri $uri/index.html =404;
    }
}
```

También funciona cualquier contenedor de archivos estáticos
(`nginx:alpine` + `COPY dist /usr/share/nginx/html`), MinIO/S3 + CDN, etc.

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

## Actualizar la documentación

1. Editar o crear un `.md` en `src/content/docs/docs/` (frontmatter mínimo:
   `title` y `description`).
2. Si es una página nueva, agregarla al `sidebar` de `astro.config.mjs`.
3. `npm run dev` para previsualizar; commit + push (o rebuild) para publicar.
