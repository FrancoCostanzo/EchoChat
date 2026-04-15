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
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](https://opensource.org/licenses/ISC)

<br/>

<p align="center">
  <strong>EchoChat</strong> es una plataforma de comunicación interna empresarial completa y moderna, construida con un stack full-stack JavaScript. Soporta mensajería directa, conversaciones grupales, canales, videollamadas, compartición de archivos, difusiones (broadcasts) y mucho más — todo en tiempo real.
</p>

<br/>

[Características](#-características) · [Tech Stack](#-tech-stack) · [Arquitectura](#-arquitectura) · [Instalación](#-instalación) · [Variables de Entorno](#-variables-de-entorno) · [Scripts](#-scripts) · [Base de Datos](#-base-de-datos) · [API](#-api-endpoints) · [Websockets](#-eventos-en-tiempo-real-socketio)

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
- Thumbnails automáticos para imágenes/videos
- URLs prefirmadas con TTL para acceso seguro
- Deduplicación por hash SHA256
- Eliminación de metadatos EXIF por privacidad
- Infraestructura para escaneo antivirus

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
- Hashing de contraseñas con bcrypt
- Gestión de sesiones multi-dispositivo
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

## 🛠 Tech Stack

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

## 📦 Instalación

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

Ejecutar el script SQL para crear el esquema completo:

```bash
psql -U tu_usuario -d echochat -f backend/docs/messaging_intranet_schema.sql
```

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
cd ../frontend-web
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
cd frontend-web
npm run dev
```

La aplicación estará disponible en **http://localhost:5173** 🚀

<br/>

---

<br/>

## 🔧 Variables de Entorno

Crear un archivo `backend/.env` con las siguientes variables:

```env
# ──── General ─────────────────────────────────
NODE_ENV=development
PORT=3000

# ──── PostgreSQL ──────────────────────────────
DB_HOST=localhost
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
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false

# ──── CORS ────────────────────────────────────
CORS_ORIGIN=http://localhost:5173

# ──── Rate Limiting ───────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ──── Logging ─────────────────────────────────
LOG_LEVEL=info
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
├── 📁 api-collection/            # Colección de API (Postman)
├── 📁 backend/
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
├── 📁 frontend-web/
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

Este proyecto está bajo la licencia **ISC**.

---

<br/>

Hecho con ❤️ por [Franco Costanzo](https://github.com/FrancoCostanzo)

</div>
