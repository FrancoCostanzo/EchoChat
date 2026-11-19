---
title: Instalación (desarrollo)
description: Levantar EchoChat localmente sin Docker para desarrollo.
---

Guía para correr EchoChat en tu máquina para desarrollo. Para producción, mirá
[Despliegue con Docker](/docs/despliegue).

## Prerrequisitos

- **Node.js** >= 22
- **PostgreSQL** >= 15 (o **SQL Server** >= 2019 con `DB_CLIENT=mssql`)
- **MinIO** u otro almacenamiento compatible con S3 — opcional: con
  `STORAGE_DRIVER=local` los archivos van a una carpeta del disco

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

## 3. Configurar el almacenamiento

Dos opciones:

- **MinIO** (o cualquier S3): tenerlo corriendo y apuntar `MINIO_ENDPOINT` a él. Los
  buckets se crean automáticamente al iniciar el backend.
- **Disco local**: poner `STORAGE_DRIVER=local` en `backend/.env`. Los archivos quedan en
  `backend/storage-data/` y el backend los sirve con URLs firmadas — no hace falta nada más.

Detalle en [Almacenamiento](/docs/despliegue/almacenamiento).

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

Editá los valores según tu entorno: conexión a la base y al almacenamiento, `JWT_SECRET`,
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

## 7. App de escritorio (opcional)

Con el backend y el frontend ya corriendo (paso 6):

```bash
cd desktop
npm install
npm run dev
```

Abre una ventana de Electron cargando el frontend en modo dev — mismo HMR que en el
navegador. Buildear instaladores y publicar releases está en
[App de escritorio](/docs/uso/escritorio) y en
[`docs/STYLE_GUIDE.md`](https://github.com/FrancoCostanzo/EchoChat/blob/main/docs/STYLE_GUIDE.md#-guía-de-estilos--desktop-electron)
dentro del repositorio.
