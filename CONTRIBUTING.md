# Contribuir a EchoChat

¡Gracias por tu interés en contribuir a EchoChat! Esta guía resume cómo levantar el entorno, las convenciones del proyecto y el flujo esperado para proponer cambios.

Antes de nada, dale una leída al [Código de Conducta](./CODE_OF_CONDUCT.md) — se aplica a toda interacción en este repositorio.

## 🐛 Reportar bugs y proponer features

- **Bugs**: abrí un Issue describiendo el comportamiento esperado vs. el actual, pasos para reproducirlo y tu entorno (Docker / dev local, navegador, versión de Node, etc.).
- **Ideas y preguntas generales**: usá [Discussions](https://github.com/FrancoCostanzo/EchoChat/discussions) en vez de Issues — mantiene la lista de Issues enfocada en trabajo accionable.
- **Vulnerabilidades de seguridad**: **no** las reportes en un Issue público — seguí la [Política de Seguridad](./SECURITY.md).

## 🧰 Levantar el entorno de desarrollo

Prerrequisitos: Node.js ≥ 18, PostgreSQL ≥ 15, MinIO (o compatible S3).

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat

# Esquema de base de datos
psql -U tu_usuario -d echochat -f backend/docs/messaging_intranet_schema.sql

# Backend
cd backend
cp .env.example .env    # completar DB_*, JWT_SECRET, MinIO, CORS
npm install
npm run dev             # http://localhost:3000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev             # http://localhost:5173
```

Más detalle sobre variables de entorno, buckets de MinIO y modos de despliegue con Docker está en el [README](./README.md).

## 🌿 Flujo de ramas

- Las ramas de trabajo salen de **`develop`**, no de `main`.
- Nomenclatura: `feat/nombre-corto`, `fix/nombre-corto`. Los `hotfix/...` sí salen de `main`, reservados para arreglos urgentes en producción.
- **No se commitea directo a `main` ni a `develop`** — todo cambio entra vía Pull Request.
- Los PRs los abre cada colaborador manualmente; no se generan de forma automática (incluso si estás usando un agente/IA para asistirte).

## 📝 Convención de commits

Formato: `Tipo <emoji>: descripción en español`, explicando el **por qué** del cambio, no solo el qué.

| Tipo         | Emoji | Uso                            |
| ------------ | ----- | ------------------------------- |
| Feat         | 🆕    | Funcionalidad nueva              |
| Fix          | 🔧/🐛 | Corrección de error / hotfix     |
| Refactor     | ♻️    | Refactor sin cambio funcional    |
| Style        | 🎨    | Formato/estilo de código         |
| Docs         | 🗒️    | Documentación                    |
| Clean        | 🧹    | Mantenimiento                    |
| Perf         | ⚡    | Mejora de rendimiento            |
| Test         | ✅    | Agregar o corregir tests         |
| Dependencies | 📦    | Actualización de dependencias    |

Ejemplo: `Fix 🐛: resolver crash en login LDAP`

Ver `docs/STYLE_GUIDE.md` para el detalle completo de convenciones (código backend y frontend).

## ✅ Checklist antes de abrir un Pull Request

- [ ] El código sigue las convenciones de `docs/STYLE_GUIDE.md` (camelCase en JS, snake_case en columnas de BD, no saltar capas backend: controller → service → repository).
- [ ] Probaste los endpoints/flows afectados (colección Bruno en `tooling/bruno/` para el backend).
- [ ] Si tocaste texto visible en el frontend, está traducido en **es**, **en** y **pt** (`useTranslation()` / `frontend/src/locales/`).
- [ ] La rama sale de `develop` (o de `main` si es un `hotfix`) y sigue la nomenclatura `feat/...` / `fix/...`.
- [ ] Los commits siguen el formato `Tipo <emoji>: descripción`.
- [ ] Actualizaste documentación relevante (README, ROADMAP, STYLE_GUIDE) si el cambio lo amerita.

## 🤖 Uso de agentes de IA (Cursor, etc.)

El repo incluye configuración MCP para Cursor Agent en `.cursor/mcp.json` y reglas persistentes en `AGENTS.md`. Si usás un agente para contribuir:

- El agente **nunca** debe crear PRs ni hacer `git commit`/`git push` sin que se lo pidas explícitamente.
- Las reglas de ramas y commits de esta guía aplican igual, sea código escrito a mano o asistido.

## 📄 Licencia

Al contribuir, aceptás que tu código se distribuya bajo los términos de la licencia del proyecto, **AGPL-3.0** (ver [LICENSE](./LICENSE)).
