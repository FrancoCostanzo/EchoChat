---
title: Instalación (desarrollo)
description: Levantar EchoChat localmente sin Docker para desarrollo.
---

Guía para correr EchoChat en tu máquina para desarrollo. Para producción, mirá
[Despliegue con Docker](/docs/despliegue).

## Prerrequisitos

- **Node.js** >= 18
- **PostgreSQL** >= 15
- **MinIO** (o cualquier almacenamiento compatible con S3)

## 1. Clonar el repositorio

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat
```

## 2. Configurar la base de datos

Solo creá la base **vacía**; el esquema, las migraciones, el seed y el primer
administrador se aplican solos cuando arranca el backend (paso 6):

```bash
createdb -U tu_usuario echochat
```

:::tip
Si preferís prepararla sin levantar la app, corré `npm run migrate` desde `backend/`
(usa el mismo `.env`). Detalle del modelo en [Base de datos](/docs/despliegue/base-de-datos).
:::

## 3. Configurar MinIO

Asegurate de tener MinIO corriendo. Los buckets se crean automáticamente al iniciar el
backend (`messaging-avatars`, `messaging-images`, `messaging-videos`, `messaging-audio`,
`messaging-documents`, `messaging-thumbnails`, `messaging-recordings`, `messaging-stickers`).

## 4. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## 5. Configurar variables de entorno

Creá un archivo `.env` en la carpeta `backend/` a partir del ejemplo:

```bash
cp backend/.env.example backend/.env
```

Editá los valores según tu entorno: conexión a PostgreSQL y MinIO, `JWT_SECRET`,
`MESSAGE_ENC_KEY` (obligatoria) y `ADMIN_USERNAME`/`ADMIN_PASSWORD` para el primer
administrador. Ver [Variables de entorno](/docs/despliegue/variables-entorno).

## 6. Iniciar la aplicación

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

La aplicación estará disponible en **http://localhost:5173** 🚀
