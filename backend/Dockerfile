# ── Etapa 1: Build ─────────────────────────────────────────────────────
# Compila src/ a dist/. Necesita las devDependencies: TypeScript y los @types
# viven ahí.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Etapa 2: Runtime ───────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# La imagen no trae devDependencies, y el logger carga pino-pretty cuando el
# entorno es 'development'. Sin este default, un contenedor lanzado sin definir
# NODE_ENV crashea al arrancar. El .env / compose lo pueden sobreescribir igual.
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# dist/ replica la estructura de src/, así que las rutas relativas del código
# (../../docs, ../../package.json) siguen resolviendo igual que antes.
COPY --from=build /app/dist ./dist
# SQL de schema + migraciones: el backend los aplica al arrancar (ver migrate.js)
COPY docs/ ./docs/

EXPOSE 3000

USER node

CMD ["node", "dist/server.js"]
