<div align="center">

# 💬 EchoChat

### Plataforma de Mensajería en Tiempo Real para Empresas

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white)](https://min.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

<br/>

<p align="center">
  <strong>EchoChat</strong> es una plataforma de comunicación interna empresarial completa y moderna, construida con un stack full-stack JavaScript. Soporta mensajería directa, conversaciones grupales, canales, videollamadas, compartición de archivos, difusiones (broadcasts) y mucho más — todo en tiempo real.
</p>

<br/>

[Características](#-características) · [Plataformas](#-plataformas) · [Tech Stack](#-tech-stack) · [Arquitectura](#-arquitectura) · [Despliegue](#-despliegue-con-docker) · [Instalación Dev](#-instalación-desarrollo) · [Backend](#-backend--guía-de-desarrollo) · [Frontend](#-frontend--guía-de-desarrollo) · [Cursor AI](#-cursor-ai-mcp-y-agentes) · [Git](#-git--commits-y-colaboración) · [Variables de Entorno](#-variables-de-entorno) · [Scripts](#-scripts) · [Base de Datos](#-base-de-datos) · [API](#-api-endpoints) · [Websockets](#-eventos-en-tiempo-real-socketio)

</div>

---

<br/>

## ✨ Características

<table>
<tr>
<td width="50%">

### 💬 Mensajería
- Mensajes directos (1:1) y grupales
- Edición y eliminación de mensajes con historial
- Reacciones con emojis
- Respuestas en hilo (threads)
- Reenvío de mensajes
- Búsqueda full-text de mensajes
- Mensajes fijados (pinned) por conversación
- Mensajes guardados/favoritos con notas
- Borradores auto-guardados
- Indicadores de escritura en tiempo real
- Recibos de lectura y entrega (doble tick ✓✓)

</td>
<td width="50%">

### 📞 Llamadas
- Llamadas de voz (1:1)
- Videollamadas (1:1 y grupales)
- Compartir pantalla
- Llamadas en conferencia
- Grabación de llamadas con consentimiento
- Controles de silencio por host
- Estadísticas de calidad (RTT, jitter, packet loss)
- Historial de llamadas

</td>
</tr>
<tr>
<td width="50%">

### 👥 Conversaciones y Canales
- Conversaciones directas, grupales y canales
- Canales con categorías: anuncios, departamento, proyecto, general
- Canales oficiales y descubribles
- Modos de acceso: abierto, solo invitación, solicitud
- Roles por miembro: owner, admin, moderador, miembro, viewer
- Archivar, silenciar y fijar conversaciones
- Log de eventos del grupo

</td>
<td width="50%">

### 📢 Difusiones (Broadcasts)
- Listas de difusión personalizadas
- Envío masivo sin visibilidad entre receptores
- Difusiones programadas
- Seguimiento de entrega y lectura por destinatario
- Difusiones basadas en plantillas

</td>
</tr>
<tr>
<td width="50%">

### 📁 Almacenamiento de Archivos
- Subida de archivos a MinIO (S3-compatible)
- Soporte: imágenes, videos, audio, documentos, grabaciones
- URLs prefirmadas con TTL para acceso seguro (con caché y limpieza automática)
- 🔧 *Planificado:* thumbnails automáticos, deduplicación por SHA256, strip de EXIF y escaneo antivirus (ver `docs/ROADMAP.md`, Fase 4)

</td>
<td width="50%">

### 📊 Encuestas (Polls)
- Encuestas embebidas en mensajes
- Opciones de respuesta múltiple
- Encuestas anónimas
- Selección múltiple
- Conteo de votos en tiempo real
- Cierre y expiración de encuestas

</td>
</tr>
<tr>
<td width="50%">

### 🔐 Autenticación y Seguridad
- JWT con access y refresh tokens
- Autenticación de dos factores (2FA TOTP) con códigos de respaldo
- Hashing de contraseñas con bcrypt
- Gestión de sesiones multi-dispositivo
- RBAC aplicado por endpoint (permisos globales) y por conversación (roles)
- RBAC con permisos globales y por conversación
- Helmet para headers HTTP seguros
- Rate limiting (100 req / 15 min)
- CORS configurado
- Redacción de headers sensibles en logs
- Soft delete para datos

</td>
<td width="50%">

### 🔔 Notificaciones
- Notificaciones in-app en tiempo real
- Infraestructura para push, email y SMS
- Preferencias por tipo de evento
- Horarios y días de silencio configurables
- Contador de no leídas (badge)
- Marcar todo como leído

</td>
</tr>
<tr>
<td width="50%">

### 👤 Usuarios y Contactos
- Perfiles con departamento, cargo, extensión
- Presencia en tiempo real: online, offline, away, busy, dnd
- Mensaje de estado personalizado
- Avatares almacenados en MinIO
- Búsqueda de usuarios
- Contactos, bloqueados y favoritos

</td>
<td width="50%">

### 🌐 Internacionalización y Temas
- **3 idiomas**: Español 🇪🇸 · Inglés 🇬🇧 · Portugués 🇧🇷
- Cambio de idioma dinámico
- Modos: claro ☀️ / oscuro 🌙 / sistema
- **6 colores de acento**: Blue · Violet · Green · Rose · Orange · Cyan
- Persistencia de preferencias en localStorage

</td>
</tr>
</table>

<br/>

---

<br/>

## � Plataformas

| Plataforma | Tecnología | Estado |
|------------|-----------|--------|
| **Web** | React 19 + Vite | ✅ En desarrollo (`v1.0.0-alpha.4`) |
| **Desktop** (Windows, macOS, Linux) | Electron | 🔧 Planificado |
| **Mobile** (iOS, Android) | React Native + Expo | 🔧 Planificado |

Las tres plataformas comparten el mismo backend y reutilizan la mayoría de la lógica de negocio del frontend.

<br/>

---

<br/>

## �🛠 Tech Stack

<table>
<tr>
<th align="center">Capa</th>
<th align="center">Tecnologías</th>
</tr>
<tr>
<td><strong>Frontend</strong></td>
<td>
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/HeroUI-000?style=flat-square" alt="HeroUI"/>
  <img src="https://img.shields.io/badge/Zustand-433E38?style=flat-square" alt="Zustand"/>
  <img src="https://img.shields.io/badge/React_Router_7-CA4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"/>
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white" alt="Framer Motion"/>
  <img src="https://img.shields.io/badge/i18next-26A69A?style=flat-square&logo=i18next&logoColor=white" alt="i18next"/>
  <img src="https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square" alt="Lucide"/>
</td>
</tr>
<tr>
<td><strong>Backend</strong></td>
<td>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js_4-000000?style=flat-square&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/Joi-0080FF?style=flat-square" alt="Joi"/>
  <img src="https://img.shields.io/badge/Pino-687634?style=flat-square" alt="Pino"/>
  <img src="https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="JWT"/>
  <img src="https://img.shields.io/badge/Multer-FF6600?style=flat-square" alt="Multer"/>
</td>
</tr>
<tr>
<td><strong>Base de Datos</strong></td>
<td>
  <img src="https://img.shields.io/badge/PostgreSQL_15+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
</td>
</tr>
<tr>
<td><strong>Almacenamiento</strong></td>
<td>
  <img src="https://img.shields.io/badge/MinIO_(S3)-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO"/>
</td>
</tr>
<tr>
<td><strong>Seguridad</strong></td>
<td>
  <img src="https://img.shields.io/badge/Helmet-000?style=flat-square" alt="Helmet"/>
  <img src="https://img.shields.io/badge/bcrypt-003A70?style=flat-square" alt="bcrypt"/>
  <img src="https://img.shields.io/badge/Rate_Limiting-FF4444?style=flat-square" alt="Rate Limit"/>
  <img src="https://img.shields.io/badge/CORS-00ACC1?style=flat-square" alt="CORS"/>
</td>
</tr>
<tr>
<td><strong>Desktop</strong></td>
<td>
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron"/>
</td>
</tr>
<tr>
<td><strong>Mobile</strong></td>
<td>
  <img src="https://img.shields.io/badge/React_Native-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React Native"/>
  <img src="https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo"/>
</td>
</tr>
<tr>
<td><strong>Infraestructura</strong></td>
</table>

<br/>

---

<br/>

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Pages   │  │  Stores  │  │Components│  │  API Client   │  │
│  │          │  │ (Zustand) │  │          │  │  (Axios)      │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └───────┬───────┘  │
│       │              │                              │           │
│       └──────────────┼──────────────────────────────┘           │
│                      │          ↕ Socket.IO                     │
└──────────────────────┼──────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │   Vite Dev Proxy    │
            │  /api → :3000/api   │
            │  /ws  → :3000/ws    │
            └──────────┬──────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────┐
│                    BACKEND (Express + Socket.IO)                 │
│                      │                                          │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │                     Middlewares                            │  │
│  │  Auth · Validate · Rate Limit · Error Handler · Logging   │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                          │
│  ┌──────────┐  ┌─────▼──────┐  ┌──────────┐  ┌────────────┐   │
│  │  Routes  │→ │Controllers │→ │ Services │→ │Repositories│   │
│  └──────────┘  └────────────┘  └──────────┘  └──────┬─────┘   │
│                                                      │          │
│  ┌──────────┐  ┌──────────┐                          │          │
│  │   DTOs   │  │  Models  │                          │          │
│  │  (Joi)   │  │(Transform│                          │          │
│  └──────────┘  └──────────┘                          │          │
└──────────────────────────────────────┬───────────────┘──────────┘
                                       │
                    ┌──────────────────┐│┌──────────────────┐
                    │   PostgreSQL     │││     MinIO         │
                    │   (20+ tablas)   │││  (Object Storage) │
                    └──────────────────┘│└──────────────────┘
                                        │
```

### Capas del Backend

| Capa | Responsabilidad |
|------|----------------|
| **Routes** | Definición de endpoints HTTP |
| **Controllers** | Manejo de requests, validación, respuestas HTTP |
| **Services** | Lógica de negocio |
| **Repositories** | Acceso a datos con query builders |
| **Models** | DTOs y transformadores de respuesta |
| **Middlewares** | Autenticación, validación, rate limiting, error handling, logging |

<br/>

---

<br/>

## � Despliegue con Docker

EchoChat se puede desplegar con **Docker Compose** en 3 modos según la infraestructura disponible:

| Modo | ¿Qué levanta Docker? | ¿Qué ya tiene la empresa? |
|------|----------------------|--------------------------|
| **Todo en uno** | Backend + Frontend + PostgreSQL + MinIO | Nada, todo en un servidor |
| **Mixto** | Backend + Frontend + lo que falte | PostgreSQL y/o MinIO existente |
| **Solo app** | Backend + Frontend | PostgreSQL + MinIO propios |

### Prerrequisitos

- **Docker** >= 20
- **Docker Compose** >= 2.20

### Modo 1: Todo en uno (un solo servidor)

Ideal para empezar rápido. Levanta todo en un mismo servidor:

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat

# Copiar y editar la configuración
cp .env.example .env
```

Editar `.env` con estos valores:

```env
# Activar PostgreSQL y MinIO integrados
COMPOSE_PROFILES=postgres,minio

# Passwords seguras (cambiar obligatoriamente)
DB_PASSWORD=mi_password_segura_postgres
MINIO_SECRET_KEY=mi_password_segura_minio

# Secreto JWT (generar uno aleatorio)
JWT_SECRET=generar_con_node_-e_console.log(require('crypto').randomBytes(64).toString('hex'))

# Clave de cifrado de mensajes en reposo — 32 bytes en base64 (OBLIGATORIA)
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MESSAGE_ENC_KEY=clave_de_32_bytes_en_base64

# Primer administrador (se crea solo en el primer arranque)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mi_password_de_admin

# URL pública: poner la IP o dominio del servidor
CORS_ORIGIN=http://192.168.1.100
MINIO_PUBLIC_ENDPOINT=192.168.1.100
```

```bash
docker compose up -d
```

La app estará en **http://192.168.1.100** (o la IP/dominio configurado). Inicie
sesión con el usuario `ADMIN_USERNAME` / `ADMIN_PASSWORD` y cambie la contraseña.

> **Nota:** Al arrancar, el backend prepara la base de datos automáticamente:
> aplica el esquema, corre las migraciones pendientes (registradas en la tabla
> `schema_migrations`, así que es seguro reiniciar) y crea el primer `super_admin`
> a partir de `ADMIN_USERNAME`/`ADMIN_PASSWORD` si todavía no existe ninguno. Los
> buckets de MinIO también se crean solos. No hay que ejecutar ningún `psql` ni
> seed a mano.

### Modo 2: La empresa ya tiene PostgreSQL y/o MinIO

Si ya existen servidores de base de datos o almacenamiento, simplemente apuntar a ellos:

```env
# No activar ningún perfil (o solo el que necesite)
COMPOSE_PROFILES=

# PostgreSQL externo
DB_HOST=10.0.1.50
DB_PORT=5432
DB_NAME=echochat
DB_USER=echochat
DB_PASSWORD=password_del_postgres_existente

# MinIO/S3 externo
MINIO_ENDPOINT=10.0.1.51
MINIO_PORT=9000
MINIO_ACCESS_KEY=access_key_existente
MINIO_SECRET_KEY=secret_key_existente
MINIO_PUBLIC_ENDPOINT=10.0.1.51
```

> **Nota:** Con PostgreSQL externo **no** hace falta ejecutar nada a mano: el
> backend detecta que la BD está vacía, aplica el esquema y las migraciones al
> arrancar, y crea el primer administrador. (Si prefiere prepararla antes de
> levantar la app, puede correr `npm run migrate` desde `backend/` apuntando al
> mismo `.env`.)

### Modo 3: Mixto (ej: BD externa, MinIO local)

```env
# Solo activar MinIO local
COMPOSE_PROFILES=minio

# PostgreSQL apunta al servidor existente
DB_HOST=10.0.1.50
DB_PASSWORD=password_del_postgres_existente

# MinIO se levanta local
MINIO_ENDPOINT=minio
MINIO_PUBLIC_ENDPOINT=192.168.1.100
```

O al revés — PostgreSQL local y MinIO externo:

```env
COMPOSE_PROFILES=postgres
DB_HOST=postgres

MINIO_ENDPOINT=minio.empresa.com
MINIO_PUBLIC_ENDPOINT=minio.empresa.com
MINIO_PORT=9000
```

### Diagrama de despliegue

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Servidor (docker compose)                       │
│                                                                     │
│  ┌─────────────┐    ┌─────────────────┐    ┌───────────────────┐   │
│  │   Nginx     │    │     Backend     │    │    PostgreSQL     │   │
│  │  (Frontend) │───▶│  (Node.js API)  │───▶│  (perfil:postgres)│   │
│  │   :80       │    │  :3000 interno  │    │  :5432 interno    │   │
│  └─────────────┘    └────────┬────────┘    └───────────────────┘   │
│        │                     │                                      │
│        │ /api, /socket.io    │             ┌───────────────────┐   │
│        └─────────────────────┘             │      MinIO        │   │
│                                            │  (perfil: minio)  │   │
│                                    ───────▶│  :9000 API        │   │
│                                            │  :9001 Consola    │   │
│                                            └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                          ▲
         │ HTTP :80                                  │ :9000 (presigned URLs)
    ┌────┴────┐                                ┌────┴────┐
    │ Usuario │                                │ Usuario │
    │ Browser │ ◀──────────────────────────────│ Browser │
    └─────────┘    (descarga de archivos)      └─────────┘
```

### Comandos útiles

```bash
# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar solo el backend
docker compose restart backend

# Reconstruir imágenes tras cambios de código
docker compose build --no-cache
docker compose up -d

# Detener todo
docker compose down

# Detener y eliminar volúmenes (⚠️ borra datos de BD y archivos)
docker compose down -v
```

### Consola de MinIO

Cuando usa el MinIO integrado, la consola web está disponible en `http://IP_DEL_SERVIDOR:9001` con las credenciales configuradas en `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`.

<br/>

---

<br/>

## 📦 Instalación (Desarrollo)

Para desarrollo local sin Docker.

### Prerrequisitos

- **Node.js** >= 18
- **PostgreSQL** >= 15
- **MinIO** (o cualquier almacenamiento compatible con S3)

### 1. Clonar el repositorio

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat
```

### 2. Configurar la base de datos

Solo hay que crear la base **vacía**; el esquema, las migraciones y el primer
administrador se aplican solos cuando arranca el backend (paso 6):

```bash
createdb -U tu_usuario echochat
```

> Si preferís prepararla sin arrancar la app, corré `npm run migrate` desde
> `backend/` (usa el mismo `.env`). El backend lleva el control en la tabla
> `schema_migrations`, así que es seguro re-ejecutarlo.

### 3. Configurar MinIO

Asegurate de tener MinIO corriendo. Los buckets se crean automáticamente al iniciar el backend:

| Bucket | Descripción |
|--------|------------|
| `messaging-avatars` | Fotos de perfil |
| `messaging-images` | Imágenes en mensajes |
| `messaging-videos` | Videos en mensajes |
| `messaging-audio` | Archivos de audio |
| `messaging-documents` | Documentos (PDF, DOC, etc.) |
| `messaging-thumbnails` | Thumbnails auto-generados |
| `messaging-recordings` | Grabaciones de llamadas |
| `messaging-stickers` | Paquetes de stickers |

### 4. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Configurar variables de entorno

Crear un archivo `.env` en la carpeta `backend/` (ver [Variables de Entorno](#-variables-de-entorno)).

### 6. Iniciar la aplicación

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

La aplicación estará disponible en **http://localhost:5173** 🚀

<br/>

---

<br/>

## 🖥 Backend — Guía de desarrollo

### Stack y responsabilidades

| Tecnología | Uso en EchoChat |
|------------|-----------------|
| **Express 4** | API REST bajo `/api` |
| **Socket.IO 4** | Mensajes, typing, presencia, llamadas en tiempo real |
| **PostgreSQL 15+** | Persistencia (30+ tablas) |
| **MinIO** | Archivos S3-compatible (avatares, adjuntos, grabaciones) |
| **Joi** | Validación de entrada en DTOs |
| **JWT + bcrypt** | Autenticación y sesiones |
| **Pino** | Logging estructurado |

### Estructura de carpetas

```
backend/src/
├── app.js              # Express: middlewares globales y montaje de rutas
├── server.js           # Arranque HTTP, jobs cron, shutdown graceful
├── socket.js           # Autenticación JWT en sockets y eventos realtime
├── config/             # PostgreSQL pool, MinIO client, logger
├── routes/             # Definición de endpoints
├── controllers/        # req/res HTTP (sin lógica de negocio)
├── services/           # Reglas de negocio
├── repositories/       # Queries SQL (prepared statements)
├── models/             # Transformadores toXxxResponse()
├── dtos/               # Esquemas Joi por operación
├── middlewares/        # authenticate, authorize, validate, rateLimit
├── errors/             # AppError y jerarquía de errores
└── jobs/               # Tareas programadas (presencia, URLs prefirmadas)
```

### Flujo de una petición HTTP

```
Route → validate(dto) → authenticate → authorize → Controller → Service → Repository → PostgreSQL
                                           ↓
                                     Model (transform)
                                           ↓
                                      Response JSON
```

### Convenciones clave

- **Archivos:** `camelCase.tipo.js` — p. ej. `message.controller.js`, `user.repository.js`
- **Código JS:** `camelCase` · **BD:** columnas en `snake_case`
- **Errores:** lanzar `AppError`; el `errorHandler` centraliza la respuesta HTTP
- **RBAC:** permisos globales (`authorize`) y roles por conversación en services
- **No saltar capas:** un controller nunca llama directo a un repository

### Arrancar y depurar

```bash
cd backend
cp .env.example .env    # Ajustar DB_*, JWT_SECRET, MinIO, CORS
npm install
npm run dev             # nodemon + pino-pretty en :3000
```

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con hot-reload |
| `npm start` | Producción (sin pretty logs) |

Health check: `GET http://localhost:3000/api/health`

Probar endpoints: colección Bruno en `tooling/bruno/`.

<br/>

---

<br/>

## 🎨 Frontend — Guía de desarrollo

### Stack y responsabilidades

| Tecnología | Uso en EchoChat |
|------------|-----------------|
| **React 19** | UI declarativa, Suspense + lazy routes |
| **Vite 8** | Dev server, HMR, build de producción |
| **Tailwind CSS 4** | Estilos utility-first |
| **HeroUI 3** | Componentes accesibles (Button, Modal, Input, etc.) |
| **Zustand 5** | Estado global por dominio |
| **React Router 7** | Navegación SPA |
| **Socket.IO Client** | Eventos en tiempo real |
| **i18next** | Español, inglés y portugués |
| **Framer Motion** | Transiciones y animaciones |
| **Lucide React** | Iconografía |

### Estructura de carpetas

```
frontend/src/
├── App.jsx             # Rutas y providers
├── main.jsx            # Punto de entrada React
├── index.css           # Tokens CSS, tema claro/oscuro, acentos
├── pages/              # Vistas (LoginPage, ConversationPage, …)
├── layouts/            # ChatLayout y shells
├── components/         # Piezas reutilizables (GuildRail, ThreadPanel, …)
├── stores/             # authStore, chatStore, themeStore
├── lib/                # api.js, socket.js, endpoints.js, i18n
└── locales/            # es.json · en.json · pt.json
```

### Proxy de desarrollo (Vite)

El frontend en `:5173` proxifica al backend en `:3000`:

| Ruta en el browser | Destino |
|--------------------|---------|
| `/api/*` | `http://localhost:3000/api/*` |
| `/socket.io/*` | WebSocket → `:3000` |

No hace falta configurar CORS en desarrollo si usas el dev server de Vite.

### Convenciones clave

- **Alias:** `@/` → `src/` (ver `vite.config.js`)
- **Componentes:** funcionales, props destructuradas, `export default`
- **Stores:** un store por dominio; selectores atómicos `useStore((s) => s.campo)`
- **i18n obligatorio:** todo texto visible en **es**, **en** y **pt** — usar `useTranslation()`
- **Páginas:** lazy import en `App.jsx` para code splitting

### Arrancar

```bash
cd frontend
cp .env.example .env    # Si aplica variables VITE_*
npm install
npm run dev             # http://localhost:5173
```

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build estático para producción |
| `npm run preview` | Preview del build |

Guía de estilos detallada: `docs/STYLE_GUIDE.md` (sección Frontend).

<br/>

---

<br/>

## 🤖 Cursor AI — MCP y agentes

EchoChat incluye configuración para que **Cursor Agent** use herramientas MCP y siga convenciones del proyecto.

### Archivos relevantes

| Archivo | Propósito |
|---------|-----------|
| `.cursor/mcp.json` | Servidores MCP del proyecto (HeroUI, PostgreSQL) |
| `AGENTS.md` | Instrucciones persistentes para el agente de Cursor |
| `docs/STYLE_GUIDE.md` | Convenciones de código backend y frontend |

### Servidores MCP configurados

| Servidor | Para qué sirve |
|----------|----------------|
| `heroui-react` | Documentación, props y estilos de componentes HeroUI |
| `postgres-echochat` | Consultas read-only al esquema PostgreSQL de EchoChat |

### Activar MCP en Cursor

1. Asegurate de tener **Node.js ≥ 18** instalado.
2. En `backend/.env`, define `DATABASE_URL` (necesario solo para el MCP de Postgres):

   ```env
   DATABASE_URL=postgresql://echochat:tu_password@localhost:5432/echochat
   ```

3. **Reinicia Cursor** tras cambiar `.cursor/mcp.json`.
4. Verifica en **Settings → Tools & MCP** que los servidores estén activos.
5. Si falla alguno: panel **Output** → canal **MCP Logs**.

El agente usa estas herramientas automáticamente cuando son relevantes (p. ej. consultar props de un componente HeroUI o inspeccionar tablas de la BD).

> `frontend/.vscode/mcp.json` es formato VS Code/Copilot. Cursor usa `.cursor/mcp.json` en la raíz del repositorio.

<br/>

---

<br/>

## 🌿 Git — Commits y colaboración

### Reglas para agentes y colaboradores

- **Nunca crear PRs automáticamente** — los abre el maintainer manualmente.
- **No ejecutar `git commit` ni `git push`** sin pedido explícito.
- Ramas de feature/fix desde `develop`; **no commitear directo a `main`**.

### Formato de commits

Cuando se pida un commit, usar:

```
Tipo <emoji>: descripción en español
```

La descripción debe explicar el **por qué**, no solo el qué.

| Tipo | Emoji | Uso | Ejemplo |
|------|-------|-----|---------|
| **Feat** | 🆕 | Funcionalidad nueva | `Feat 🆕: Nuevo menú para crear un usuario` |
| **Fix** | 🔧 | Corrección de error | `Fix 🔧: corregir cálculo de stock mínimo` |
| **Fix** | 🐛 | Bug / hotfix | `Fix 🐛: resolver crash en login LDAP` |
| **Refactor** | ♻️ | Refactor sin cambio funcional | `Refactor ♻️: extraer lógica a service` |
| **Style** | 🎨 | Formato/estilo de código | `Style 🎨: ordenar imports en routesConfig` |
| **Docs** | 🗒️ | Documentación | `Docs 🗒️: actualizar README con nuevas rutas` |
| **Clean** | 🧹 | Mantenimiento | `Clean 🧹: actualizar dependencias` |
| **Perf** | ⚡ | Mejora de rendimiento | `Perf ⚡: optimizar query con índice` |
| **Release** | 🎉 | Nueva versión de producción | `Release 🎉: v3.0.2` |
| **Test** | ✅ | Agregar o corregir tests | `Test ✅: tests para notificaciones` |
| **Dependencies** | 📦 | Actualización de dependencias | `Dependencies 📦: actualizar pg a v8.21` |

Convención de ramas: `feat/nombre-corto`, `fix/nombre-corto`, `hotfix/...` (desde `main`). Detalle completo en `docs/STYLE_GUIDE.md`.

<br/>

---

<br/>

## 🔧 Variables de Entorno

Para **desarrollo** local, crear un archivo `backend/.env`. Para **producción** con Docker, editar `.env` en la raíz del proyecto (ver `.env.example`).

```env
# ──── General ─────────────────────────────────
NODE_ENV=development
PORT=3000

# ──── PostgreSQL ──────────────────────────────
DB_HOST=localhost           # En Docker todo-en-uno: postgres
DB_PORT=5432
DB_NAME=echochat
DB_USER=echochat
DB_PASSWORD=tu_password_seguro
DB_POOL_MIN=2
DB_POOL_MAX=20

# ──── JWT ─────────────────────────────────────
JWT_SECRET=tu_clave_secreta_muy_segura
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ──── MinIO (Object Storage) ─────────────────
MINIO_ENDPOINT=localhost    # En Docker todo-en-uno: minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false

# Endpoint público (cómo los navegadores acceden a MinIO)
# En desarrollo: localhost | En producción: IP o dominio del servidor
MINIO_PUBLIC_ENDPOINT=localhost
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false

# ──── CORS ────────────────────────────────────
CORS_ORIGIN=http://localhost:5173   # En Docker: http://IP_DEL_SERVIDOR

# ──── Rate Limiting ───────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ──── Logging ─────────────────────────────────
LOG_LEVEL=info

# ──── Docker Compose (solo producción) ────────
# Perfiles: postgres,minio (activar los que necesite)
COMPOSE_PROFILES=postgres,minio
FRONTEND_PORT=80
MINIO_CONSOLE_PORT=9001
```

<br/>

---

<br/>

## 📜 Scripts

### Backend

| Comando | Descripción |
|---------|------------|
| `npm start` | Iniciar servidor en producción |
| `npm run dev` | Iniciar servidor en desarrollo con hot-reload (nodemon + pino-pretty) |

### Frontend

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Iniciar servidor de desarrollo Vite (auto-open + proxy) |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build de producción |

<br/>

---

<br/>

## 🗄 Base de Datos

EchoChat utiliza **PostgreSQL 15+** con más de **30 tablas** organizadas en los siguientes módulos:

<details>
<summary><strong>👤 Autenticación y Usuarios</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `users` | Tabla principal de usuarios con perfil |
| `user_credentials` | Contraseñas, bloqueo de cuenta, historial |
| `user_sessions` | Sesiones multi-dispositivo con hash JWT |
| `roles` | Definiciones de roles |
| `permissions` | Definiciones de permisos |
| `user_roles` | Asignación de roles globales |
| `role_permissions` | Mapeo rol-permiso |
| `user_relationships` | Contactos, bloqueados, favoritos |

</details>

<details>
<summary><strong>💬 Mensajería</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `messages` | Tabla principal de mensajes |
| `message_edits` | Historial de ediciones |
| `message_receipts` | Estado de lectura/entrega por usuario |
| `message_reactions` | Reacciones con emojis |
| `message_attachments` | Vinculación mensajes-archivos |
| `saved_messages` | Mensajes guardados/favoritos |
| `pinned_messages` | Mensajes fijados |
| `drafts` | Borradores auto-guardados |

</details>

<details>
<summary><strong>👥 Conversaciones</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `conversations` | Datos principales de conversación/canal/grupo |
| `conversation_members` | Membresía con roles y estado de lectura |
| `conversation_events` | Log de auditoría de eventos del grupo |
| `channel_settings` | Configuración extendida de canales |
| `channel_join_requests` | Solicitudes de ingreso a canales restringidos |

</details>

<details>
<summary><strong>📞 Llamadas</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `calls` | Registros de llamadas |
| `call_participants` | Participantes con estado individual |
| `call_recordings` | Referencias a grabaciones con consentimiento |

</details>

<details>
<summary><strong>📢 Difusiones y Encuestas</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `broadcast_lists` | Definición de listas de difusión |
| `broadcast_recipients` | Miembros de listas |
| `broadcast_messages` | Mensajes de difusión |
| `broadcast_deliveries` | Estado de entrega por destinatario |
| `polls` | Preguntas de encuestas |
| `poll_options` | Opciones con conteo de votos |
| `poll_votes` | Votos individuales |

</details>

<details>
<summary><strong>🔔 Notificaciones y Sistema</strong></summary>

| Tabla | Descripción |
|-------|------------|
| `notifications` | Registros de notificaciones |
| `notification_preferences` | Preferencias por usuario y evento |
| `storage_objects` | Referencias a archivos en MinIO |
| `storage_presigned_urls` | URLs prefirmadas cacheadas |
| `audit_log` | Log de auditoría inmutable |
| `system_settings` | Configuración clave-valor del sistema |

</details>

**Extensiones PostgreSQL utilizadas:** `uuid-ossp` · `pg_trgm` · `btree_gin`

<br/>

---

<br/>

## 🌐 API Endpoints

Todas las rutas están bajo el prefijo `/api`.

| Módulo | Ruta Base | Descripción |
|--------|-----------|------------|
| 🔑 Auth | `/api/auth` | Registro, login, logout, cambio de contraseña, sesiones |
| 👤 Users | `/api/users` | Perfil, búsqueda, presencia, avatar |
| 💬 Conversations | `/api/conversations` | CRUD de conversaciones y miembros |
| 📨 Messages | `/api/messages` | Envío, edición, eliminación, reacciones, recibos, búsqueda, fijados |
| 📞 Calls | `/api/calls` | Crear, actualizar estado, participantes, historial |
| 📁 Storage | `/api/storage` | Upload, URLs prefirmadas, descarga |
| 📢 Broadcasts | `/api/broadcasts` | Listas y mensajes de difusión |
| 🔔 Notifications | `/api/notifications` | Listado, lectura, preferencias |
| 🤝 Relationships | `/api/relationships` | Contactos, bloqueados, favoritos |
| 💚 Health | `/api/health` | Health check |

<br/>

---

<br/>

## ⚡ Eventos en Tiempo Real (Socket.IO)

### Server → Client

| Evento | Descripción |
|--------|------------|
| `message:new` | Nuevo mensaje en conversación |
| `message:edited` | Mensaje editado |
| `message:deleted` | Mensaje eliminado |
| `message:reaction` | Reacción agregada/eliminada |
| `typing:start` | Usuario comenzó a escribir |
| `typing:stop` | Usuario dejó de escribir |
| `messages:read` | Mensajes marcados como leídos |
| `presence:update` | Cambio de presencia de usuario |
| `conversation:updated` | Info de conversación actualizada |
| `call:incoming` | Llamada entrante |
| `call:status` | Cambio de estado de llamada |

### Client → Server

| Evento | Descripción |
|--------|------------|
| `join:conversation` | Unirse a la sala de una conversación |
| `typing:start` | Emitir indicador de escritura |
| `typing:stop` | Detener indicador de escritura |
| `messages:read` | Enviar recibos de lectura |

> La autenticación del socket se realiza vía JWT token. Al conectarse, cada usuario se une automáticamente a su sala personal (`user:{userId}`) y a las salas de sus conversaciones (`conv:{conversationId}`).

<br/>

---

<br/>

## 📂 Estructura del Proyecto

```
EchoChat/
├── 📄 AGENTS.md                   # Instrucciones para Cursor Agent
├── 📁 .cursor/
│   └── 📄 mcp.json                # Servidores MCP (HeroUI, PostgreSQL)
├── 📄 docker-compose.yml          # Orquestación (perfiles: postgres, minio)
├── 📄 .env.example                # Template de configuración Docker
├── 📁 tooling/bruno/              # Colección de API (Bruno / OpenCollection)
├── 📁 backend/
│   ├── 📄 Dockerfile              # Imagen Docker del backend
│   ├── 📄 .dockerignore
│   ├── 📁 docs/
│   │   └── 📄 messaging_intranet_schema.sql
│   ├── 📁 src/
│   │   ├── 📄 app.js              # Configuración de Express
│   │   ├── 📄 server.js           # Punto de entrada del servidor
│   │   ├── 📄 socket.js           # Configuración de Socket.IO
│   │   ├── 📁 config/             # Configuración (DB, MinIO, Logger)
│   │   ├── 📁 controllers/        # Controladores HTTP
│   │   ├── 📁 dtos/               # Esquemas de validación (Joi)
│   │   ├── 📁 errors/             # Clases de error personalizadas
│   │   ├── 📁 middlewares/        # Auth, validación, error handler
│   │   ├── 📁 models/             # Transformadores de respuesta
│   │   ├── 📁 repositories/      # Capa de acceso a datos
│   │   ├── 📁 routes/             # Definiciones de rutas
│   │   └── 📁 services/           # Lógica de negocio
│   └── 📄 package.json
├── 📁 frontend/
│   ├── 📄 Dockerfile              # Build multi-etapa (Node → Nginx)
│   ├── 📄 .dockerignore
│   ├── 📁 nginx/
│   │   └── 📄 default.conf.template  # Proxy reverso + SPA
│   ├── 📁 public/
│   ├── 📁 src/
│   │   ├── 📄 App.jsx             # Componente raíz con rutas
│   │   ├── 📄 main.jsx            # Punto de entrada
│   │   ├── 📁 components/         # Componentes reutilizables
│   │   ├── 📁 layouts/            # Layouts de la app
│   │   ├── 📁 lib/                # Utilidades, API client, i18n
│   │   ├── 📁 locales/            # Traducciones (es, en, pt)
│   │   ├── 📁 pages/              # Páginas de la aplicación
│   │   └── 📁 stores/             # Estado global (Zustand)
│   ├── 📄 index.html
│   ├── 📄 vite.config.js
│   └── 📄 package.json
└── 📁 docs/                       # Documentación adicional
    ├── 📄 STYLE_GUIDE.md
    ├── 📄 SPATIAL_CANVAS.md       # Sistema visual Lienzo Espacial
    └── 📄 ROADMAP.md
```

<br/>

---

<br/>

## 🚀 Proceso de Inicio

### Backend

```
1. ✅ Verificar conexión a PostgreSQL
2. ✅ Crear buckets de MinIO (si no existen)
3. ✅ Inicializar Socket.IO sobre HTTP server
4. ✅ Iniciar servidor HTTP + WebSocket
5. ✅ Manejo de shutdown graceful (SIGINT, SIGTERM)
```

### Frontend

```
1. ✅ Vite dev server en puerto 5173
2. ✅ Inicializar i18n (cargar preferencia de idioma)
3. ✅ Aplicar tema guardado
4. ✅ Inicializar auth store (verificar token en localStorage)
5. ✅ Montar app React
6. ✅ Conectar Socket.IO tras autenticación
```

<br/>

---

<br/>

## 🔒 Seguridad

| Medida | Implementación |
|--------|---------------|
| Autenticación | JWT con access + refresh tokens |
| Hashing | bcrypt para contraseñas |
| Headers HTTP | Helmet con configuración segura |
| Rate Limiting | 100 requests / 15 min por IP |
| CORS | Orígenes configurables |
| Validación | Joi schemas en todas las rutas |
| SQL Injection | Prepared statements |
| Datos sensibles | Redacción de headers en logs |
| Archivos | URLs prefirmadas con expiración |
| Privacidad | Stripping de metadatos EXIF |
| Eliminación | Soft delete en mensajes y usuarios |
| RBAC | Permisos granulares globales y por conversación |

<br/>

---

<br/>

## ⚙️ Optimizaciones de Rendimiento

- **20+ índices** en columnas frecuentemente consultadas
- **Connection pooling** de PostgreSQL (min: 2, max: 20)
- **Full-text search** con trigramas (`pg_trgm`)
- **Índices compuestos** para patrones de query comunes
- **Campos desnormalizados** para lecturas rápidas (`last_message_at`, conteos de no leídos)
- **Rooms** de Socket.IO para broadcasting eficiente
- **Lazy-loading** de repositorios para evitar dependencias circulares
- **Proxy** de Vite para evitar problemas de CORS en desarrollo

<br/>

---

<br/>

<div align="center">

## 📄 Licencia

Este proyecto está bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consultá el archivo [LICENSE](LICENSE) para más detalles.

Esto significa que si ofrecés EchoChat (modificado o no) como un servicio accesible por red, estás obligado a poner a disposición el código fuente correspondiente.

---

<br/>

Hecho con ❤️ por [Franco Costanzo](https://github.com/FrancoCostanzo)

</div>
