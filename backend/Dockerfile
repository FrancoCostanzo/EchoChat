FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
# SQL de schema + migraciones: el backend los aplica al arrancar (ver migrate.js)
COPY docs/ ./docs/

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
