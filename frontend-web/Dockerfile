# ── Etapa 1: Build ─────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Etapa 2: Servir con Nginx ─────────────────────────────────────────
FROM nginx:alpine

# Eliminar config por defecto
RUN rm /etc/nginx/conf.d/default.conf

# Copiar template de nginx (se procesa con envsubst al iniciar)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Copiar archivos compilados del frontend
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
