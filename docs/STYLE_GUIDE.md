<div align="center">

# 📐 EchoChat — Guía de Estilos y Convenciones

</div>

<br/>

---

<br/>

## 📑 Tabla de Contenidos

- [Convención de Commits](#-convención-de-commits)
- [Convención de Ramas](#-convención-de-ramas)
- [Versionado del Software](#-versionado-del-software)
- [Guía de Estilos — Backend](#-guía-de-estilos--backend)
- [Guía de Estilos — Frontend](#-guía-de-estilos--frontend)
- [Convenciones Compartidas](#-convenciones-compartidas)

<br/>

---

<br/>

## 📝 Convención de Commits

Todos los mensajes de commit deben seguir el formato:

```
<tipo> <emoji> <descripción corta>
```

**Ejemplo:**

```
Feat 🆕 Agregar soporte de encuestas en mensajes
Fix 🐛 Corregir desconexión de socket al cambiar de conversación
```

### Tipos de Commit

| Tipo | Emoji | Cuándo usarlo |
|------|:-----:|---------------|
| **Feat** | 🆕 | Nueva funcionalidad o feature |
| **Fix** | 🐛 | Corrección de un bug |
| **Hotfix** | 🚑 | Corrección crítica en producción |
| **Refactor** | ♻️ | Reestructuración de código sin cambiar funcionalidad |
| **Change** | 🔄️ | Cambio en funcionalidad existente (no es fix ni feat) |
| **Clean** | 🧹 | Limpieza de código, eliminar código muerto, TODOs |
| **Style** | 🎨 | Cambios de formato, espaciado, comillas (no afecta lógica) |
| **Docs** | 📝 | Cambios en documentación |
| **Test** | 🧪 | Agregar o corregir tests |
| **Config** | 🔧 | Cambios en configuración, variables de entorno, tooling |
| **Perf** | ⚡ | Mejora de rendimiento |
| **Security** | 🔒 | Corrección o mejora de seguridad |
| **Release** | 🎉 | Nueva versión o release |
| **Deps** | 📦 | Agregar, actualizar o eliminar dependencias |
| **Revert** | ⏪ | Revertir un commit anterior |
| **WIP** | 🚧 | Trabajo en progreso (solo en ramas de desarrollo) |

### Reglas

1. **Descripción en español**, concisa y en imperativo: *"Agregar..."*, *"Corregir..."*, *"Eliminar..."*
2. **Primera línea máximo 72 caracteres**
3. Si se necesita más contexto, dejar una línea en blanco y agregar un cuerpo descriptivo
4. Referenciar issues cuando aplique: `(#42)`

### Ejemplos completos

```bash
# Feature
git commit -m "Feat 🆕 Agregar indicador de typing en conversaciones"

# Bug fix
git commit -m "Fix 🐛 Corregir cálculo de mensajes no leídos"

# Hotfix en producción
git commit -m "Hotfix 🚑 Corregir crash al subir archivos > 10MB"

# Refactor
git commit -m "Refactor ♻️ Extraer lógica de paginación a BaseRepository"

# Cambio funcional
git commit -m "Change 🔄️ Modificar rate limit de 100 a 200 req/15min"

# Limpieza
git commit -m "Clean 🧹 Eliminar endpoints deprecados de broadcasts"

# Config / Tooling
git commit -m "Config 🔧 Actualizar configuración de Docker Compose"

# Documentación
git commit -m "Docs 📝 Documentar endpoints de la API de llamadas"

# Seguridad
git commit -m "Security 🔒 Sanitizar headers en respuestas de error"

# Performance
git commit -m "Perf ⚡ Agregar índice compuesto en message_receipts"

# Dependencias
git commit -m "Deps 📦 Actualizar socket.io a v4.8"

# Release
git commit -m "Release 🎉 v1.2.0"

# Revert
git commit -m "Revert ⏪ Revertir cambio en validación de JWT (#55)"
```

<br/>

---

<br/>

## 🌿 Convención de Ramas

### Ramas Permanentes

| Rama | Propósito |
|------|-----------|
| `main` | Código en producción. Solo recibe merges de `hotfix/*` y `release/*` |
| `develop` | Rama de integración. Base para todas las features en desarrollo |

### Ramas de Corta Duración

Todas se crean desde `develop` (salvo `hotfix/*`, que sale de `main`).

```
<tipo>/<descripcion-en-kebab-case>
```

| Tipo | Cuándo usarlo | Ejemplo |
|------|---------------|---------|
| `feat/` | Nueva funcionalidad | `feat/typing-indicator` |
| `fix/` | Corrección de bug | `fix/unread-count-calculation` |
| `hotfix/` | Corrección crítica en producción (sale de `main`) | `hotfix/crash-on-file-upload` |
| `release/` | Preparación de una nueva versión | `release/1.3.0` |
| `refactor/` | Reestructuración sin cambio funcional | `refactor/pagination-base-repository` |
| `chore/` | Tareas de configuración, tooling, CI | `chore/update-docker-compose` |
| `docs/` | Cambios exclusivamente de documentación | `docs/api-calls-endpoints` |

### Reglas

1. **`kebab-case`** para la descripción, sin mayúsculas ni espacios
2. **Corta y descriptiva:** máximo 4-5 palabras separadas por guiones
3. Si está relacionada a un issue, se puede añadir el número al final: `feat/polls-support-42`
4. **Eliminar la rama** después del merge
5. **Nunca commitear directamente** a `main`

### Flujo de Ramas

```
main ──────────────────────────────────────────────────► (producción)
  ↑                                              ↑
  └─── hotfix/crash-on-file-upload               └─── release/1.3.0
                                                          ↑
develop ──────────────────────────────────────────────►  │
  ↑            ↑              ↑                          │
  └─ feat/...  └─ fix/...     └─ refactor/...  ──────────┘
```

<br/>

---

<br/>

## 🏷 Versionado del Software

EchoChat sigue **Semantic Versioning 2.0.0** ([semver.org](https://semver.org)):

```
MAJOR.MINOR.PATCH
```

| Segmento | Cuándo se incrementa | Ejemplo |
|----------|---------------------|---------|
| **MAJOR** | Cambios incompatibles (breaking changes en la API, migración de BD con ruptura) | `1.0.0` → `2.0.0` |
| **MINOR** | Nueva funcionalidad compatible hacia atrás | `1.2.0` → `1.3.0` |
| **PATCH** | Corrección de bugs compatible hacia atrás | `1.3.0` → `1.3.1` |

### Pre-releases

```
<MAJOR>.<MINOR>.<PATCH>-<etiqueta>.<numero>
```

| Etiqueta | Significado | Ejemplo |
|----------|------------|-------|
| `alpha` | Funcionalidad incompleta, solo para desarrollo interno | `1.3.0-alpha.1` |
| `beta` | Funcionalidad completa, en pruebas | `1.3.0-beta.2` |
| `rc` | Release candidate, candidato a producción | `1.3.0-rc.1` |

### Reglas

1. Al incrementar `MAJOR`, resetear `MINOR` y `PATCH` a `0`
2. Al incrementar `MINOR`, resetear `PATCH` a `0`
3. La versión `0.y.z` es para desarrollo inicial; la API no es estable hasta `1.0.0`
4. Una vez publicada una versión, **no se modifica**: cualquier cambio implica una nueva versión
5. Las versiones se etiquetan en git con `v` prefijo: `v1.3.0`

### Proceso de Release

```bash
# 1. Crear rama de release desde develop
git checkout develop
git checkout -b release/1.3.0

# 2. Actualizar version en package.json (backend y frontend)
npm version 1.3.0 --no-git-tag-version

# 3. Commit de versión
git commit -m "Release 🎉 v1.3.0"

# 4. Merge a main y etiquetar
git checkout main
git merge --no-ff release/1.3.0
git tag v1.3.0

# 5. Merge de vuelta a develop
git checkout develop
git merge --no-ff release/1.3.0

# 6. Eliminar rama de release
git branch -d release/1.3.0
```

<br/>

---

<br/>

## 🖥 Guía de Estilos — Backend

### Estructura de Carpetas

```
backend/src/
├── app.js              # Configuración de Express (middlewares, rutas)
├── server.js           # Punto de entrada (start del servidor HTTP)
├── socket.js           # Configuración de Socket.IO
├── config/             # Configuración centralizada (DB, MinIO, Logger)
├── controllers/        # Manejo de req/res HTTP
├── services/           # Lógica de negocio
├── repositories/       # Acceso a datos (SQL queries)
├── models/             # Transformadores de respuesta (toXxxResponse)
├── dtos/               # Esquemas de validación Joi
├── middlewares/         # Auth, validación, rate limiting, error handling
├── errors/             # Clases de error personalizadas
└── routes/             # Definición de endpoints
```

### Flujo de una Request

```
Route → validate(dto) → authenticate → Controller → Service → Repository → PostgreSQL
                                           ↓
                                     Model (transform)
                                           ↓
                                      Response JSON
```

### Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos | `camelCase.tipo.js` | `auth.controller.js`, `message.service.js` |
| Clases | `PascalCase` | `AuthService`, `UserRepository`, `BaseRepository` |
| Variables y funciones | `camelCase` | `userId`, `displayName`, `findByUsername()` |
| Constantes | `UPPER_SNAKE_CASE` | `SALT_ROUNDS`, `TOKEN_KEY` |
| Columnas de BD | `snake_case` | `created_at`, `last_seen_at`, `display_name` |
| Parámetros de ruta | `:camelCase` | `:conversationId`, `:messageId` |
| Archivos index | `index.js` | Re-exportan todo el directorio |

### Formateo

- **Indentación:** 2 espacios
- **Comillas:** Simples (`'texto'`)
- **Punto y coma:** Siempre presente
- **Trailing commas:** Sí, en estructuras multilínea
- **Separadores de sección:** Comentarios ASCII

```javascript
// ── Auth ────────────────────────────────────────
router.post('/register', validate(registerDto), (req, res) => authController.register(req, res));
```

### Módulos y Exports

- **CommonJS** (`require` / `module.exports`)
- **Singletons:** Las clases se instancian al exportar
- **Index files:** Cada directorio tiene un `index.js` que re-exporta

```javascript
// Exportar singleton
class AuthService {
  // ...
}
module.exports = new AuthService();

// index.js de un directorio
module.exports = {
  authController: require('./auth.controller'),
  userController: require('./user.controller'),
  // ...
};
```

### Controllers

- Clases singleton con métodos `async`
- Solo manejan `req` / `res`, **no contienen lógica de negocio**
- Usan `StatusCodes` de `http-status-codes`
- Delegan todo al Service correspondiente

```javascript
const { StatusCodes } = require('http-status-codes');
const { authService } = require('../services');
const { toUserResponse } = require('../models');

class AuthController {
  async register(req, res) {
    const user = await authService.register(req.body, req.ip, req.get('user-agent'));
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: toUserResponse(user),
    });
  }

  async login(req, res) {
    const result = await authService.login(req.body, req.ip, req.get('user-agent'));
    res.json({ status: 'success', data: result });
  }
}

module.exports = new AuthController();
```

### Services

- Contienen **toda la lógica de negocio**
- Lanzan errores tipados (`AppError` y subclases)
- Usan el `logger` de Pino para operaciones importantes
- Socket.IO se carga de forma lazy para evitar dependencias circulares

```javascript
const { userRepository, credentialRepository } = require('../repositories');
const { NotFoundError, ConflictError } = require('../errors');
const logger = require('../config/logger');

class AuthService {
  async register(data, ip, userAgent) {
    const existing = await userRepository.findByUsername(data.username);
    if (existing) {
      throw new ConflictError('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await userRepository.create({ ...data, password: hashedPassword });

    logger.info({ userId: user.id }, 'New user registered');
    return user;
  }
}

module.exports = new AuthService();
```

### Repositories

- Extienden `BaseRepository` para operaciones CRUD comunes
- Queries parametrizadas con `$1, $2, ...` (prevención de SQL injection)
- SQL crudo para queries complejas (JOINs, aggregates)
- Soft delete: marcan registros como `'deleted'`, no los eliminan

```javascript
const BaseRepository = require('./base.repository');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByUsername(username) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.tableName} WHERE username = $1 AND status != 'deleted'`,
      [username]
    );
    return rows[0] || null;
  }
}

module.exports = new UserRepository();
```

### DTOs (Validación con Joi)

- Un archivo por módulo con todos los schemas de ese dominio
- Mensajes de error personalizados cuando es necesario
- Exportan un objeto literal con los schemas

```javascript
const Joi = require('joi');

const registerDto = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9._]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, dots and underscores',
    }),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  display_name: Joi.string().max(100).allow('', null),
});

module.exports = { registerDto, loginDto, changePasswordDto };
```

### Rutas

- Organizadas por feature, una por archivo
- `authenticate` como middleware de grupo para rutas protegidas
- Validación vía `validate(dto)` antes del controller

```javascript
const { Router } = require('express');
const { authenticate } = require('../middlewares');
const { validate } = require('../middlewares');
const { registerDto, loginDto } = require('../dtos');
const { authController } = require('../controllers');

const router = Router();

// ── Públicas ────────────────────────────────────
router.post('/register', validate(registerDto), (req, res) => authController.register(req, res));
router.post('/login', validate(loginDto), (req, res) => authController.login(req, res));

// ── Protegidas ──────────────────────────────────
router.use(authenticate);
router.post('/logout', (req, res) => authController.logout(req, res));

module.exports = router;
```

### Errores Personalizados

- `AppError` como clase base con `statusCode` y `details` opcionales
- Subclases tipadas para cada caso de error HTTP
- El middleware `errorHandler` captura y formatea todas las respuestas de error

```javascript
// Jerarquía de errores
AppError (base)
├── BadRequestError    (400)
├── UnauthorizedError  (401)
├── ForbiddenError     (403)
├── NotFoundError      (404)
└── ConflictError      (409)
```

### Formato de Respuesta

Todas las respuestas HTTP siguen este formato consistente:

```javascript
// Éxito
{
  "status": "success",
  "data": { ... }
}

// Error
{
  "status": "error",
  "message": "Descripción del error",
  "details": [ ... ]  // opcional, para errores de validación
}
```

### Logging (Pino)

- Logger estructurado con contexto (`userId`, `path`, `method`)
- Niveles: `info`, `warn`, `error`, `fatal`
- Headers sensibles redactados (`Authorization`, `Cookie`)
- Pretty-printing en desarrollo vía `pino-pretty`

```javascript
logger.info({ userId: user.id }, 'New user registered');
logger.error({ err, conversationId }, 'Failed to send message');
logger.warn({ ip, attempts }, 'Rate limit approaching');
```

### Socket.IO

- Autenticación via JWT en el handshake
- Rooms por usuario (`user:{userId}`) y por conversación (`conv:{conversationId}`)
- Eventos con nomenclatura `recurso:acción`: `message:new`, `typing:start`
- Carga lazy de servicios para evitar dependencias circulares

```javascript
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  // validar token...
  socket.userId = user.id;
  next();
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  // registrar event listeners...
});
```

<br/>

---

<br/>

## 🎨 Guía de Estilos — Frontend

### Estructura de Carpetas

```
frontend/src/
├── App.jsx              # Componente raíz con React Router
├── main.jsx             # Punto de entrada (render)
├── index.css            # Estilos globales y variables CSS
├── components/          # Componentes reutilizables
├── pages/               # Componentes de página (rutas)
├── layouts/             # Layouts de la app (sidebar, etc.)
├── stores/              # Estado global (Zustand)
├── lib/                 # Utilidades: API client, i18n, socket, helpers
└── locales/             # Archivos de traducción (es.json, en.json, pt.json)
```

### Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Componentes (archivo) | `PascalCase.jsx` | `UserAvatar.jsx`, `ImageViewer.jsx` |
| Utilidades (archivo) | `camelCase.js` | `api.js`, `socket.js`, `i18n.js` |
| Stores (archivo) | `camelCase.js` | `authStore.js`, `chatStore.js` |
| Componentes (función) | `PascalCase` | `function UserAvatar()` |
| Hooks | `useCamelCase` | `useAuthStore`, `useTranslation` |
| Variables y funciones | `camelCase` | `handleSubmit`, `isLoading`, `userName` |
| Constantes | `UPPER_SNAKE_CASE` | `TOKEN_KEY`, `EASE_OUT` |
| Props | `camelCase` | `showStatus`, `className`, `onClose` |
| Eventos handler | `handleNombre` / `onNombre` | `handleSubmit`, `onClose` |

### Formateo

- **Indentación:** 2 espacios
- **Comillas:** Simples en JS (`'texto'`), dobles en JSX (`className="..."`)
- **Punto y coma:** Siempre presente
- **Trailing commas:** Sí
- **Paréntesis en JSX:** Multilínea envuelto en `()`

### Módulos y Exports

- **ES Modules** (`import` / `export`)
- **Path alias:** `@/` apunta a `src/` (configurado en `vite.config.js`)
- **Lazy loading:** Páginas cargadas con `lazy()` para code splitting
- **Barrel exports:** No obligatorios en frontend, se usan imports directos

```javascript
// Imports agrupados por origen
import { useState, useEffect } from 'react';         // 1. React / librerías
import { useTranslation } from 'react-i18next';       // 2. Librerías externas
import { useAuthStore } from '@/stores/authStore';     // 3. Stores
import { api } from '@/lib/api';                       // 4. Utilidades internas
import UserAvatar from '@/components/UserAvatar';      // 5. Componentes

// Lazy loading de páginas
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
```

### Componentes React

- **Functional components** únicamente (no class components)
- **Destructuring de props** en los parámetros
- **Valores por defecto** en los parámetros
- **`memo()`** para componentes de alto rendimiento
- **`export default`** para el componente principal del archivo

```javascript
import { memo } from 'react';

function UserAvatar({ user, size = 'md', showStatus = false, className = '' }) {
  const initials = (user?.display_name || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* avatar content */}
    </div>
  );
}

export default memo(UserAvatar);
```

### Estado Global (Zustand)

- **Un store por dominio:** `authStore`, `chatStore`, `themeStore`
- **Selectores atómicos:** `useAuthStore((s) => s.user)` (no desestructurar todo el store)
- **Acciones dentro del store:** Métodos que actualizan el estado
- **Async dentro del store:** Llamadas a la API directamente en las acciones
- **localStorage** para persistencia manual de auth y preferencias

```javascript
import { create } from 'zustand';
import { api } from '@/lib/api';

const TOKEN_KEY = 'echochat-token';

export const useAuthStore = create((set, get) => ({
  // ── Estado ──────────────────────────
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: true,

  // ── Acciones ────────────────────────
  login: async (credentials) => {
    const { data } = await authApi.login(credentials);
    localStorage.setItem(TOKEN_KEY, data.token);
    api.setToken(data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    api.setToken(null);
    set({ user: null, token: null, isAuthenticated: false, loading: false });
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ loading: false });
      return;
    }
    api.setToken(token);
    try {
      const { data } = await authApi.me();
      set({ user: data, isAuthenticated: true, loading: false });
    } catch {
      get().clearAuth();
    }
  },
}));
```

### Estilos (Tailwind CSS)

- **Utility-first:** Clases directamente en el JSX
- **Responsive:** Prefijos `md:`, `lg:`, `xl:`
- **Dark mode:** Clase `dark` en el root, alternable por el usuario
- **Colores de acento:** Variables CSS vía atributo `data-accent`
- **CSS personalizado mínimo:** Solo para animaciones y variables

```jsx
{/* Layout responsivo */}
<div className="flex h-screen items-center justify-center bg-linear-to-br from-background to-background-secondary p-4">

{/* Tipografía y espaciado */}
<h1 className="text-2xl font-bold text-foreground">

{/* Interactividad */}
<button className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 transition-colors">
```

### Variables CSS Personalizadas

```css
/* Colores de acento (se cambian vía data-accent) */
--accent: ...;
--accent-foreground: ...;

/* Layout */
--echo-sidebar-width: ...;
```

### API Client

- Clase singleton con campo privado `#token`
- Método privado `#request` para la lógica HTTP core
- Métodos públicos: `get()`, `post()`, `put()`, `delete()`, `upload()`
- Inyección automática del header `Authorization`

```javascript
import { api } from '@/lib/api';

// GET
const { data } = await api.get('/api/users/me');

// POST
const { data } = await api.post('/api/auth/login', { username, password });

// Upload con FormData
const { data } = await api.upload('/api/storage/upload', formData);
```

### Socket.IO (Cliente)

- Singleton a nivel de módulo (`connectSocket`, `disconnectSocket`, `getSocket`)
- Token de autenticación en el handshake
- Los listeners se registran desde el store de Zustand
- Reconexión automática manejada por socket.io-client

```javascript
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';

// Conectar después del login
const socket = connectSocket(token);

// Emitir eventos
socket.emit('typing:start', { conversationId });

// Escuchar eventos (desde el store)
socket.on('message:new', (message) => {
  // actualizar estado...
});
```

### Formularios

- **Inputs controlados** con `useState`
- **Validación touch-based:** Los errores se muestran después del `blur`
- **Errores de servidor:** Estado separado para errores async
- **Submit prevention:** Validar antes de enviar

```javascript
const [form, setForm] = useState({ username: '', password: '' });
const [touched, setTouched] = useState({});
const [serverError, setServerError] = useState('');

const errors = validate(form);
const isValid = Object.keys(errors).length === 0;

const handleSubmit = async (e) => {
  e.preventDefault();
  touchAll();
  if (!isValid) return;

  try {
    await login(form);
  } catch (err) {
    setServerError(err.message);
  }
};
```

### Animaciones (Framer Motion)

- Constantes reutilizables para curvas de animación
- `AnimatePresence` para enter/exit
- Objetos `transition` con `duration`, `ease`, `delay`

```javascript
const EASE_OUT = [0.34, 1, 0.64, 1];
const SPRING_OUT = { type: 'spring', stiffness: 300, damping: 25 };

<motion.div
  initial={{ opacity: 0, x: -12 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: 12 }}
  transition={{ duration: 0.3, ease: EASE_OUT }}
>
```

### Internacionalización (i18next)

- Hook `useTranslation()` en cada componente que muestra texto
- Archivos JSON por idioma en `locales/`
- Idioma persistido en `localStorage` bajo `echochat-lang`
- **Nunca hardcodear textos visibles al usuario**

```javascript
import { useTranslation } from 'react-i18next';

function LoginPage() {
  const { t } = useTranslation();

  return (
    <h1>{t('auth.loginTitle')}</h1>
    <Button>{t('auth.login')}</Button>
  );
}
```

### Temas

- **3 modos:** `light`, `dark`, `system`
- **6 colores de acento:** `blue`, `violet`, `green`, `rose`, `orange`, `cyan`
- Persistidos en `localStorage`
- Aplicados vía clases en `document.documentElement`

<br/>

---

<br/>

## 🤝 Convenciones Compartidas

### Formato de Datos API

| Capa | Convención | Ejemplo |
|------|-----------|---------|
| Base de datos | `snake_case` | `created_at`, `display_name` |
| API (request/response) | `snake_case` | `{ "user_id": 1, "display_name": "..." }` |
| JavaScript (frontend) | `camelCase` | `userId`, `displayName` |
| Transformación | En los Models del backend | `toUserResponse(row)` |

### Manejo de Errores

| Capa | Estrategia |
|------|-----------|
| Backend - Repository | Propagar errores de BD |
| Backend - Service | Lanzar `AppError` tipados (`NotFoundError`, `ConflictError`, etc.) |
| Backend - Controller | No atrapar errores (los captura `express-async-errors`) |
| Backend - Middleware | `errorHandler` formatea y responde |
| Frontend - Store | `try/catch` en acciones async |
| Frontend - Componente | Estado local de error + UI de feedback |

### Patrones Async

```javascript
// Backend — async/await con propagación automática de errores
async register(req, res) {
  const user = await authService.register(req.body);
  res.status(StatusCodes.CREATED).json({ status: 'success', data: user });
}

// Frontend — async/await con try/catch
const handleSubmit = async () => {
  try {
    await login(credentials);
  } catch (err) {
    setError(err.message);
  }
};
```

### Orden de Imports

**Backend (CommonJS):**
```javascript
// 1. Módulos de Node.js
const path = require('path');

// 2. Dependencias externas
const { StatusCodes } = require('http-status-codes');
const Joi = require('joi');

// 3. Módulos internos
const { authService } = require('../services');
const { toUserResponse } = require('../models');
const logger = require('../config/logger');
```

**Frontend (ES Modules):**
```javascript
// 1. React y hooks
import { useState, useEffect, memo } from 'react';

// 2. Librerías externas
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// 3. Componentes de UI (HeroUI, Lucide)
import { Button, Input } from '@heroui/react';
import { Send, Search } from 'lucide-react';

// 4. Stores
import { useAuthStore } from '@/stores/authStore';

// 5. Utilidades internas
import { api } from '@/lib/api';

// 6. Componentes propios
import UserAvatar from '@/components/UserAvatar';
```

### Seguridad

| Práctica | Implementación |
|----------|---------------|
| SQL Injection | Queries parametrizadas (`$1`, `$2`, ...) — **nunca** interpolar variables |
| XSS | React escapa por defecto, no usar `dangerouslySetInnerHTML` |
| Autenticación | JWT en header `Authorization: Bearer <token>` |
| Contraseñas | bcrypt con 12 salt rounds |
| Archivos | URLs prefirmadas con TTL |
| Headers | Helmet en Express |
| CORS | Orígenes explícitos |
| Datos sensibles | Redactar en logs, no exponer en respuestas |
| Soft delete | Marcar como `deleted`, nunca eliminar registros de BD |

<br/>

---

<br/>

<div align="center">

Última actualización: Abril 2026

</div>
