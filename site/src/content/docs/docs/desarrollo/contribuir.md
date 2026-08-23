---
title: Contribuir
description: Flujo Git, ramas, commits y guía para colaboradores.
---

## Licencia AGPL-3.0

EchoChat es software libre bajo [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0): si
ofrecés una versión modificada como servicio accesible por red, estás obligado a publicar
el código fuente correspondiente.

## Configurar el entorno

Seguí [Instalación (desarrollo)](/docs/instalacion) para levantar backend y frontend
localmente. Revisá también `AGENTS.md` en la raíz del repo si vas a trabajar con
asistencia de un agente de IA (Cursor) — define convenciones específicas del proyecto.

## Ramas y flujo de trabajo

| Rama | Propósito |
|------|-----------|
| `main` | Producción. Solo recibe merges de release/hotfix |
| `develop` | Integración. Base de todas las features |

Ramas de corta duración desde `develop` (kebab-case, con prefijo de tipo):
`feat/`, `fix/`, `refactor/`, `docs/`, `chore/`, etc. **Nunca commitear directo a
`main`**.

## Formato de commits

```
Tipo <emoji>: descripción en español (explicando el por qué, no solo el qué)
```

| Tipo | Emoji | Uso |
|------|-------|-----|
| Feat | 🆕 | Funcionalidad nueva |
| Fix | 🔧 | Corrección de error |
| Fix | 🐛 | Bug / hotfix |
| Refactor | ♻️ | Refactor sin cambio funcional |
| Style | 🎨 | Formato/estilo de código |
| Docs | 🗒️ | Documentación |
| Clean | 🧹 | Mantenimiento |
| Perf | ⚡ | Mejora de rendimiento |
| Release | 🎉 | Nueva versión de producción |
| Test | ✅ | Agregar o corregir tests |
| Dependencies | 📦 | Actualización de dependencias |

Ver la guía extendida (con más tipos y ejemplos completos) en `docs/STYLE_GUIDE.md`.

## Convenciones de código

- Backend: `camelCase.tipo.ts`, capas Route → Controller → Service → Repository, sin
  saltarse capas. Ver [Backend](/docs/desarrollo/backend).
- Frontend: componentes funcionales, alias `@/`, un store Zustand por dominio, i18n
  obligatorio en es/en/pt. Ver [Frontend](/docs/desarrollo/frontend).
- Mantené el diff mínimo: no refactorices ni documentes cosas no pedidas en el mismo
  cambio.

## Pull requests

Las PRs las abre el mantenedor manualmente — no se crean automáticamente ni por agentes
de IA. Antes de proponer un cambio grande, revisá `docs/ROADMAP.md` para ver si ya está
planificado o en progreso (ver [Estado del proyecto](/docs/estado)).

## Probar la API

Usá la colección Bruno en `tooling/bruno/` con la app [Bruno](https://www.usebruno.com/)
para probar endpoints sin escribir código. Ver el detalle de rutas en
[API REST](/docs/desarrollo/api).

## Reportar issues

Abrí un issue en el repositorio de GitHub describiendo el problema, pasos para
reproducirlo y el comportamiento esperado. Para vulnerabilidades de seguridad, evitá
publicar detalles sensibles en un issue público.

## Recursos

- [`docs/STYLE_GUIDE.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/STYLE_GUIDE.md) — convenciones completas de código
- [`docs/ROADMAP.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/ROADMAP.md) — roadmap por fases
- [`AGENTS.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/AGENTS.md) — instrucciones para agentes de IA
- Repositorio: [github.com/FrancoCostanzo/EchoChat](https://github.com/FrancoCostanzo/EchoChat)
