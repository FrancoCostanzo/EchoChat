-- =============================================================================
-- SISTEMA DE MENSAJERÍA INTRANET — v2.0
-- Base de datos: PostgreSQL 15+
-- Storage: MinIO (S3-compatible) corriendo localmente en intranet
--
-- FILOSOFÍA DE ALMACENAMIENTO:
--   La DB guarda REFERENCIAS a objetos en MinIO, nunca archivos binarios.
--   MinIO organiza los archivos en buckets. La DB guarda:
--     - bucket_name: en qué bucket está
--     - object_key:  la "ruta" dentro del bucket (ej: avatars/uuid.jpg)
--   Para acceder al archivo el backend construye la URL o genera un presigned URL.
--
-- BUCKETS RECOMENDADOS EN MINIO:
--   messaging-avatars      → avatares de usuarios y grupos
--   messaging-images       → imágenes enviadas en mensajes
--   messaging-videos       → videos enviados en mensajes
--   messaging-audio        → audios y mensajes de voz
--   messaging-documents    → archivos PDF, DOC, ZIP, etc.
--   messaging-thumbnails   → previews/miniaturas generadas por el backend
--   messaging-recordings   → grabaciones de llamadas
--   messaging-stickers     → packs de stickers
-- =============================================================================

-- Activar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUIDs únicos para entidades
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- Hashing de contraseñas / datos sensibles
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Búsqueda full-text con trigramas
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- Índices combinados para JSONB y arrays

-- =============================================================================
-- SECCIÓN 1: USUARIOS Y AUTENTICACIÓN
-- =============================================================================

-- Tabla principal de usuarios del sistema
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username         VARCHAR(50) UNIQUE NOT NULL,
    display_name     VARCHAR(100) NOT NULL,
    email            VARCHAR(255) UNIQUE,
    phone_extension  VARCHAR(20),           -- Extensión telefónica interna
    department       VARCHAR(100),
    job_title        VARCHAR(100),

    -- Avatar almacenado en MinIO (bucket: messaging-avatars)
    -- Ejemplo: object_key = "avatars/uuid-del-usuario.webp"
    -- Para construir URL: https://minio.intranet/{bucket}/{object_key}
    avatar_bucket    VARCHAR(100) DEFAULT 'messaging-avatars',
    avatar_object_key VARCHAR(500),         -- NULL = usa avatar por defecto generado

    status           VARCHAR(20) DEFAULT 'active'
                     CHECK (status IN ('active','inactive','suspended','deleted')),
    presence         VARCHAR(20) DEFAULT 'offline'
                     CHECK (presence IN ('online','offline','away','busy','dnd')),
    presence_message VARCHAR(200),          -- Ej: "En reunión hasta las 15:00"
    last_seen_at     TIMESTAMPTZ,
    timezone         VARCHAR(50) DEFAULT 'America/Argentina/Cordoba',
    locale           VARCHAR(10) DEFAULT 'es-AR',
    metadata         JSONB DEFAULT '{}',    -- Extensible sin migraciones
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Credenciales separadas de la identidad del usuario (principio de separación)
CREATE TABLE user_credentials (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash    TEXT NOT NULL,         -- Usar argon2id o bcrypt en el backend
    must_change_pw   BOOLEAN DEFAULT FALSE,
    pw_changed_at    TIMESTAMPTZ DEFAULT NOW(),
    failed_attempts  INTEGER DEFAULT 0,
    locked_until     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Sesiones activas (permite multi-dispositivo y revocación individual)
CREATE TABLE user_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash       TEXT NOT NULL UNIQUE,  -- Hash del JWT, nunca el token en claro
    device_name      VARCHAR(100),          -- Ej: "PC Recepción", "Android Juan"
    device_type      VARCHAR(20)
                     CHECK (device_type IN ('web','desktop','mobile','api')),
    ip_address       INET,
    user_agent       TEXT,
    is_active        BOOLEAN DEFAULT TRUE,
    expires_at       TIMESTAMPTZ NOT NULL,
    last_activity    TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 2: ROLES Y PERMISOS
-- Sistema granular: roles globales + permisos por contexto (por conversación)
-- =============================================================================

CREATE TABLE roles (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(50) UNIQUE NOT NULL,   -- ej: super_admin, moderator, user
    display_name     VARCHAR(100) NOT NULL,
    description      TEXT,
    is_system        BOOLEAN DEFAULT FALSE,          -- TRUE = no eliminable (built-in)
    priority         INTEGER DEFAULT 0,              -- Mayor = más privilegiado
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code             VARCHAR(100) UNIQUE NOT NULL,   -- ej: "messages.send", "calls.start"
    category         VARCHAR(50) NOT NULL,           -- messages | calls | groups | media | admin
    description      TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Muchos a muchos: roles tienen permisos
CREATE TABLE role_permissions (
    role_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id    UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Asignación de roles globales a usuarios
CREATE TABLE user_roles (
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by       UUID REFERENCES users(id),
    granted_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at       TIMESTAMPTZ,                    -- Soporta roles temporales
    PRIMARY KEY (user_id, role_id)
);

-- =============================================================================
-- SECCIÓN 3: ALMACENAMIENTO DE OBJETOS (MinIO/S3)
-- Esta sección es nueva respecto a v1. Centraliza toda la lógica de storage.
--
-- DISEÑO: La tabla storage_objects es el "inventario" de MinIO en la DB.
-- Cada archivo subido tiene exactamente un registro acá.
-- Nunca se guardan rutas de filesystem. Solo bucket + object_key.
-- =============================================================================

-- Registro maestro de todos los objetos almacenados en MinIO
CREATE TABLE storage_objects (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id      UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Ubicación en MinIO — con estos dos campos el backend construye cualquier URL
    bucket_name      VARCHAR(100) NOT NULL,          -- ej: messaging-images
    object_key       VARCHAR(1000) NOT NULL,          -- ej: images/2026/04/uuid.jpg
    -- Convención recomendada para object_key:
    --   {tipo}/{año}/{mes}/{uuid}.{ext}
    --   Ej: images/2026/04/f47ac10b-58cc-4372-a567.jpg
    --   Esto permite lifecycle policies por prefijo en MinIO

    -- Metadatos del archivo original
    original_filename VARCHAR(500) NOT NULL,
    mime_type        VARCHAR(100) NOT NULL,
    file_size_bytes  BIGINT NOT NULL,
    file_hash_sha256 VARCHAR(64),                    -- Para deduplicación: si el hash ya existe, reusar objeto

    -- Clasificación del archivo
    object_type      VARCHAR(20) NOT NULL
                     CHECK (object_type IN ('image','video','audio','voice','document','thumbnail','recording','sticker','avatar','gif','other')),

    -- Metadatos específicos por tipo (no nulos según object_type)
    image_width      INTEGER,                        -- Para imágenes y videos
    image_height     INTEGER,
    duration_ms      INTEGER,                        -- Para audio y video
    page_count       INTEGER,                        -- Para PDFs

    -- Thumbnail/preview del objeto (también en MinIO)
    -- Se omite si el objeto ya ES un thumbnail o no aplica
    thumbnail_bucket  VARCHAR(100) DEFAULT 'messaging-thumbnails',
    thumbnail_key     VARCHAR(1000),                 -- NULL = no tiene preview aún

    -- Estado del pipeline de procesamiento
    -- El backend procesa async: genera thumb, escanea virus, stripea EXIF
    processing_status VARCHAR(20) DEFAULT 'pending'
                      CHECK (processing_status IN ('pending','processing','ready','failed')),
    processing_error  TEXT,                          -- Detalle si falló el procesamiento
    processed_at      TIMESTAMPTZ,

    -- Seguridad
    virus_scan_status VARCHAR(20) DEFAULT 'pending'
                      CHECK (virus_scan_status IN ('pending','clean','infected','error','skipped')),
    virus_scanned_at  TIMESTAMPTZ,
    exif_stripped     BOOLEAN DEFAULT FALSE,         -- TRUE = EXIF/metadata de privacidad removida

    -- Control de acceso al objeto en MinIO
    -- 'private': solo accesible vía presigned URL generada por el backend
    -- 'public':  accesible directamente (solo para stickers/avatares/assets públicos)
    access_policy    VARCHAR(20) DEFAULT 'private'
                     CHECK (access_policy IN ('private','public')),

    -- Tiempo de vida del objeto (para archivos temporales como previews de upload)
    expires_at       TIMESTAMPTZ,                    -- NULL = permanente

    -- Referencia al ETag que devuelve MinIO al subir (útil para validación)
    etag             VARCHAR(100),

    -- Metadatos extra sin esquema fijo (codecs, fps, bitrate, etc.)
    extra_metadata   JSONB DEFAULT '{}',

    uploaded_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: bucket + key deben ser únicos (como en S3 real)
    UNIQUE (bucket_name, object_key)
);

-- Presigned URLs cacheadas (evitar regenerar en cada request)
-- El backend genera presigned URLs con TTL corto y las cachea aquí.
-- Cuando expires_at < NOW() el backend regenera y actualiza el registro.
CREATE TABLE storage_presigned_urls (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_id        UUID NOT NULL REFERENCES storage_objects(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = URL pública
    operation        VARCHAR(10) DEFAULT 'get'
                     CHECK (operation IN ('get','put','delete')),  -- Tipo de operación S3
    presigned_url    TEXT NOT NULL,                -- URL completa con firma temporal
    expires_at       TIMESTAMPTZ NOT NULL,          -- Cuándo expira la firma
    created_at       TIMESTAMPTZ DEFAULT NOW(),

    -- Una URL activa por objeto+usuario+operación
    UNIQUE (object_id, user_id, operation)
);

-- =============================================================================
-- SECCIÓN 4: CONVERSACIONES
-- Una "conversación" es la abstracción de cualquier canal de comunicación.
-- =============================================================================

CREATE TABLE conversations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type             VARCHAR(20) NOT NULL
                     CHECK (type IN ('direct','group','channel','broadcast','bot')),
    name             VARCHAR(200),                  -- NULL para chats 1:1
    description      TEXT,

    -- Ícono/avatar del grupo o canal (referencia a MinIO)
    avatar_object_id UUID REFERENCES storage_objects(id) ON DELETE SET NULL,

    topic            VARCHAR(300),                  -- Tema actual visible en el header
    is_archived      BOOLEAN DEFAULT FALSE,
    is_read_only     BOOLEAN DEFAULT FALSE,          -- Solo admins pueden escribir
    is_discoverable  BOOLEAN DEFAULT TRUE,           -- Aparece en búsqueda de canales
    max_members      INTEGER,                        -- NULL = sin límite

    created_by       UUID REFERENCES users(id),

    -- Desnormalizado para ordenar la lista de conversaciones eficientemente
    last_message_at  TIMESTAMPTZ,
    last_message_id  UUID,                           -- FK lazy (agregada al final del script)

    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Miembros de cada conversación con su rol y estado dentro del contexto
CREATE TABLE conversation_members (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role             VARCHAR(30) DEFAULT 'member'
                     CHECK (role IN ('owner','admin','moderator','member','viewer')),

    -- Estado personal de la conversación para este usuario
    is_muted         BOOLEAN DEFAULT FALSE,
    muted_until      TIMESTAMPTZ,                    -- Silenciar hasta fecha específica
    is_pinned        BOOLEAN DEFAULT FALSE,           -- Fijado en el listado del cliente
    is_hidden        BOOLEAN DEFAULT FALSE,           -- Oculto de la lista (sin salir)

    -- Control de lectura (para el "badge" de no leídos)
    last_read_at     TIMESTAMPTZ,
    last_read_msg_id UUID,

    -- Permisos específicos para este usuario en esta conversación
    -- Sobreescribe el rol global. Ej: {"can_send_media": false, "can_send_voice": true}
    custom_permissions JSONB DEFAULT '{}',

    invited_by       UUID REFERENCES users(id),
    joined_at        TIMESTAMPTZ DEFAULT NOW(),
    left_at          TIMESTAMPTZ,                    -- NULL = sigue activo en el grupo

    UNIQUE (conversation_id, user_id)
);

-- Log de eventos estructurados del grupo (quién agregó a quién, cambios de nombre, etc.)
CREATE TABLE conversation_events (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    actor_id         UUID REFERENCES users(id),
    event_type       VARCHAR(50) NOT NULL,           -- member_added | name_changed | role_changed | etc.
    target_user_id   UUID REFERENCES users(id),
    data             JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 5: MENSAJES
-- =============================================================================

CREATE TABLE messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        UUID REFERENCES users(id),      -- NULL = mensaje del sistema

    type             VARCHAR(30) DEFAULT 'text'
                     CHECK (type IN ('text','media','location','contact','system','poll','forwarded','deleted_placeholder')),

    -- Contenido de texto
    body             TEXT,
    body_format      VARCHAR(20) DEFAULT 'plain'
                     CHECK (body_format IN ('plain','markdown','html')),

    -- Hilo / respuesta
    reply_to_id      UUID REFERENCES messages(id),   -- Responde a este mensaje
    thread_id        UUID REFERENCES messages(id),   -- Raíz del hilo

    -- Reenvío
    forwarded_from_id   UUID REFERENCES messages(id),
    forwarded_from_conv UUID REFERENCES conversations(id),

    -- Control de edición / eliminación (soft delete)
    is_edited        BOOLEAN DEFAULT FALSE,
    edited_at        TIMESTAMPTZ,
    is_deleted       BOOLEAN DEFAULT FALSE,
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID REFERENCES users(id),

    -- Datos para mensajes de sistema (ej: "María se unió al grupo")
    system_data      JSONB,

    -- Preview de link en el mensaje (generado async por el backend)
    -- {url, title, description, image_url, site_name}
    link_preview     JSONB,

    -- Vector de búsqueda full-text en español (actualizado por trigger)
    search_vector    TSVECTOR,

    metadata         JSONB DEFAULT '{}',
    sent_at          TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de ediciones para auditoría y recuperación
CREATE TABLE message_edits (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    body_before      TEXT NOT NULL,
    edited_by        UUID NOT NULL REFERENCES users(id),
    edited_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Estado de entrega y lectura por usuario ("doble tilde")
CREATE TABLE message_receipts (
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at     TIMESTAMPTZ,                    -- Llegó al dispositivo
    read_at          TIMESTAMPTZ,                    -- Usuario lo vio
    PRIMARY KEY (message_id, user_id)
);

-- Reacciones (emojis) a mensajes
CREATE TABLE message_reactions (
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji            VARCHAR(10) NOT NULL,            -- Emoji unicode
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)          -- Un emoji por usuario por mensaje
);

-- Mensajes guardados/destacados por el usuario
CREATE TABLE saved_messages (
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    note             TEXT,                            -- Nota personal sobre el mensaje guardado
    saved_at         TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);

-- Mensajes fijados en una conversación (visible para todos los miembros)
CREATE TABLE pinned_messages (
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by        UUID NOT NULL REFERENCES users(id),
    pinned_at        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, message_id)
);

-- Borradores: mensaje empezado pero no enviado, persistido por usuario+conversación
CREATE TABLE drafts (
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    body             TEXT,
    reply_to_id      UUID REFERENCES messages(id),
    -- Lista de object_ids ya subidos pero aún no enviados
    -- Formato: [{"object_id": "uuid", "caption": "texto"}]
    pending_attachments JSONB DEFAULT '[]',
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, conversation_id)
);

-- =============================================================================
-- SECCIÓN 6: ADJUNTOS DE MENSAJES
-- Un mensaje puede tener múltiples archivos. Cada archivo referencia storage_objects.
-- =============================================================================

-- Asociación mensajes <-> objetos en MinIO
CREATE TABLE message_attachments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    object_id        UUID NOT NULL REFERENCES storage_objects(id),
    sort_order       INTEGER DEFAULT 0,              -- Orden para galerías multi-imagen
    caption          TEXT,                           -- Pie de foto/video
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 7: LLAMADAS Y VIDEOLLAMADAS
-- =============================================================================

CREATE TABLE calls (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID REFERENCES conversations(id),  -- NULL = llamada directa
    type             VARCHAR(20) NOT NULL
                     CHECK (type IN ('voice','video','screen_share','conference')),
    status           VARCHAR(20) DEFAULT 'pending'
                     CHECK (status IN ('pending','ringing','active','ended','missed','rejected','failed')),
    initiated_by     UUID NOT NULL REFERENCES users(id),

    -- Tiempos
    initiated_at     TIMESTAMPTZ DEFAULT NOW(),
    answered_at      TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    duration_seconds INTEGER,                        -- Calculado por trigger al poner ended_at

    end_reason       VARCHAR(30),                    -- hangup | timeout | no_answer | error | rejected

    -- Servidor de medios (para cuando tengas Janus/mediasoup/Livekit)
    server_host      VARCHAR(255),
    room_id          VARCHAR(255),
    is_encrypted     BOOLEAN DEFAULT TRUE,

    -- Stats de calidad de la llamada (guardado al finalizar)
    -- {avg_rtt_ms, max_jitter_ms, total_packets_lost, codecs_used}
    quality_stats    JSONB DEFAULT '{}',

    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Participantes individuales de cada llamada
CREATE TABLE call_participants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id          UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    status           VARCHAR(20) DEFAULT 'invited'
                     CHECK (status IN ('invited','ringing','joined','left','rejected','no_answer','busy')),

    -- Permisos dentro de la llamada (controlable por el admin/owner)
    can_speak        BOOLEAN DEFAULT TRUE,
    can_video        BOOLEAN DEFAULT TRUE,
    can_share_screen BOOLEAN DEFAULT TRUE,
    is_muted_by_host BOOLEAN DEFAULT FALSE,

    -- Tiempos individuales
    invited_at       TIMESTAMPTZ DEFAULT NOW(),
    joined_at        TIMESTAMPTZ,
    left_at          TIMESTAMPTZ,

    -- Métricas de conexión del participante
    avg_packet_loss  NUMERIC(5,2),                   -- Porcentaje
    avg_latency_ms   INTEGER,

    UNIQUE (call_id, user_id)
);

-- Grabaciones de llamadas (almacenadas en MinIO bucket: messaging-recordings)
CREATE TABLE call_recordings (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id          UUID NOT NULL REFERENCES calls(id),
    object_id        UUID NOT NULL REFERENCES storage_objects(id),  -- Referencia al archivo en MinIO
    started_by       UUID REFERENCES users(id),
    consented_by     UUID[],                         -- Array de user_ids que dieron consentimiento explícito
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    ended_at         TIMESTAMPTZ,
    is_available     BOOLEAN DEFAULT TRUE,           -- FALSE = fue eliminada por política de retención
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 8: DIFUSIONES (BROADCAST)
-- Mensajes a múltiples destinatarios sin que se vean entre sí.
-- =============================================================================

CREATE TABLE broadcast_lists (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(200) NOT NULL,
    description      TEXT,
    owner_id         UUID NOT NULL REFERENCES users(id),
    is_active        BOOLEAN DEFAULT TRUE,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE broadcast_recipients (
    broadcast_list_id UUID NOT NULL REFERENCES broadcast_lists(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by          UUID REFERENCES users(id),
    added_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (broadcast_list_id, user_id)
);

CREATE TABLE broadcast_messages (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_list_id UUID NOT NULL REFERENCES broadcast_lists(id),
    sender_id         UUID NOT NULL REFERENCES users(id),
    body              TEXT,
    type              VARCHAR(20) DEFAULT 'text'
                      CHECK (type IN ('text','media','template')),
    -- Adjunto si el broadcast tiene un archivo (misma lógica que messages)
    object_id         UUID REFERENCES storage_objects(id),
    scheduled_at      TIMESTAMPTZ,                   -- Para envíos programados
    sent_at           TIMESTAMPTZ,
    status            VARCHAR(20) DEFAULT 'draft'
                      CHECK (status IN ('draft','scheduled','sending','sent','failed')),
    -- Contadores desnormalizados (actualizados async por el worker de delivery)
    total_recipients  INTEGER DEFAULT 0,
    total_delivered   INTEGER DEFAULT 0,
    total_read        INTEGER DEFAULT 0,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Estado de entrega individual de cada broadcast
CREATE TABLE broadcast_deliveries (
    broadcast_msg_id  UUID NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    conversation_id   UUID REFERENCES conversations(id),  -- Conversación 1:1 donde se entregó
    delivered_at      TIMESTAMPTZ,
    read_at           TIMESTAMPTZ,
    PRIMARY KEY (broadcast_msg_id, user_id)
);

-- =============================================================================
-- SECCIÓN 9: CANALES
-- Configuración extendida para conversaciones de tipo "channel"
-- =============================================================================

CREATE TABLE channel_settings (
    conversation_id  UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    category         VARCHAR(50),                    -- announcements | department | project | general
    is_official      BOOLEAN DEFAULT FALSE,          -- Canal oficial de la organización
    member_count     INTEGER DEFAULT 0,              -- Desnormalizado para mostrar sin COUNT(*)
    post_restriction VARCHAR(20) DEFAULT 'members'
                     CHECK (post_restriction IN ('members','admins_only','owner_only')),
    join_mode        VARCHAR(20) DEFAULT 'open'
                     CHECK (join_mode IN ('open','invite_only','request')),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitudes de ingreso a canales con join_mode = 'request'
CREATE TABLE channel_join_requests (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    message          TEXT,                           -- "Hola, soy del área de sistemas"
    status           VARCHAR(20) DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 10: ENCUESTAS (POLLS)
-- =============================================================================

CREATE TABLE polls (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    question         TEXT NOT NULL,
    is_anonymous     BOOLEAN DEFAULT FALSE,
    is_multiple      BOOLEAN DEFAULT FALSE,          -- Permite selección múltiple
    closes_at        TIMESTAMPTZ,
    is_closed        BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id          UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text             VARCHAR(300) NOT NULL,
    sort_order       INTEGER DEFAULT 0,
    vote_count       INTEGER DEFAULT 0               -- Desnormalizado para mostrar rápido
);

CREATE TABLE poll_votes (
    poll_id          UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id        UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    voted_at         TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (poll_id, option_id, user_id)
);

-- =============================================================================
-- SECCIÓN 11: NOTIFICACIONES
-- =============================================================================

CREATE TABLE notifications (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             VARCHAR(50) NOT NULL,           -- message | mention | call | broadcast | reaction | system
    title            VARCHAR(200),
    body             TEXT,
    -- Referencia polimórfica al origen de la notificación
    reference_type   VARCHAR(30),                    -- message | call | conversation | user
    reference_id     UUID,
    reference_data   JSONB DEFAULT '{}',
    is_read          BOOLEAN DEFAULT FALSE,
    read_at          TIMESTAMPTZ,
    channel          VARCHAR(20) DEFAULT 'in_app'
                     CHECK (channel IN ('in_app','push','email','sms')),
    delivered_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_preferences (
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type           VARCHAR(50) NOT NULL,
    in_app_enabled       BOOLEAN DEFAULT TRUE,
    push_enabled         BOOLEAN DEFAULT TRUE,
    email_enabled        BOOLEAN DEFAULT FALSE,
    quiet_hours_start    TIME,                       -- Ej: '22:00'
    quiet_hours_end      TIME,                       -- Ej: '08:00'
    quiet_days           INTEGER[],                  -- 0=domingo ... 6=sábado
    PRIMARY KEY (user_id, event_type)
);

-- =============================================================================
-- SECCIÓN 12: RELACIONES ENTRE USUARIOS
-- =============================================================================

CREATE TABLE user_relationships (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             VARCHAR(20) NOT NULL
                     CHECK (type IN ('contact','blocked','favorite')),
    alias            VARCHAR(100),                   -- Apodo personalizado
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_user_id, type),
    CHECK (user_id != target_user_id)
);

-- =============================================================================
-- SECCIÓN 13: AUDITORÍA
-- Log inmutable. En producción: REVOKE DELETE, UPDATE ON audit_log FROM app_user
-- =============================================================================

CREATE TABLE audit_log (
    id               BIGSERIAL PRIMARY KEY,          -- BIGSERIAL, no UUID: inserts masivos
    actor_id         UUID REFERENCES users(id),
    action           VARCHAR(100) NOT NULL,          -- user.login | message.delete | file.upload
    resource_type    VARCHAR(50),
    resource_id      UUID,
    ip_address       INET,
    user_agent       TEXT,
    data_before      JSONB,
    data_after       JSONB,
    success          BOOLEAN DEFAULT TRUE,
    error_message    TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECCIÓN 14: CONFIGURACIÓN DEL SISTEMA
-- =============================================================================

CREATE TABLE system_settings (
    key              VARCHAR(100) PRIMARY KEY,
    value            JSONB NOT NULL,
    description      TEXT,
    category         VARCHAR(50),                    -- general | security | media | calls | storage
    updated_by       UUID REFERENCES users(id),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Usuarios
CREATE INDEX idx_users_display_name_trgm ON users USING GIN (display_name gin_trgm_ops);
CREATE INDEX idx_users_status ON users(status) WHERE status != 'deleted';
CREATE INDEX idx_users_presence ON users(presence, last_seen_at);

-- Sesiones
CREATE INDEX idx_sessions_token ON user_sessions(token_hash) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id) WHERE is_active = TRUE;

-- Storage objects: búsqueda por hash para deduplicación antes de subir a MinIO
CREATE INDEX idx_storage_hash ON storage_objects(file_hash_sha256)
    WHERE file_hash_sha256 IS NOT NULL;
-- Búsqueda de objetos pendientes de procesar (worker de procesamiento)
CREATE INDEX idx_storage_pending ON storage_objects(processing_status, uploaded_at)
    WHERE processing_status IN ('pending','processing');
-- Presigned URLs (filtrar expiradas en la consulta, NOW() no es IMMUTABLE)
CREATE INDEX idx_presigned_active ON storage_presigned_urls(object_id, user_id, operation, expires_at);

-- Mensajes (las consultas más frecuentes del sistema)
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sent_at DESC)
    WHERE is_deleted = FALSE;
CREATE INDEX idx_messages_sender ON messages(sender_id, sent_at DESC);
CREATE INDEX idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_search ON messages USING GIN(search_vector);  -- Full-text

-- Miembros de conversaciones
CREATE INDEX idx_conv_members_user ON conversation_members(user_id)
    WHERE left_at IS NULL AND is_hidden = FALSE;
CREATE INDEX idx_conv_members_conv ON conversation_members(conversation_id)
    WHERE left_at IS NULL;

-- Recibos de lectura
CREATE INDEX idx_receipts_user_unread ON message_receipts(user_id, message_id)
    WHERE read_at IS NULL;
CREATE INDEX idx_receipts_message ON message_receipts(message_id);

-- Llamadas
CREATE INDEX idx_calls_conversation ON calls(conversation_id, initiated_at DESC);
CREATE INDEX idx_calls_initiator ON calls(initiated_by, initiated_at DESC);
CREATE INDEX idx_call_participants_user ON call_participants(user_id, call_id);

-- Notificaciones
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, created_at DESC)
    WHERE is_read = FALSE;

-- Adjuntos
CREATE INDEX idx_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_attachments_object ON message_attachments(object_id);

-- Auditoría
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id, created_at DESC);

-- =============================================================================
-- TRIGGERS DE MANTENIMIENTO
-- =============================================================================

-- Función genérica para mantener updated_at actualizado
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_broadcast_lists_updated_at
    BEFORE UPDATE ON broadcast_lists FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_channel_settings_updated_at
    BEFORE UPDATE ON channel_settings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Actualizar last_message_at en la conversación al insertar un mensaje
CREATE OR REPLACE FUNCTION fn_update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.sent_at,
        last_message_id  = NEW.id,
        updated_at       = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_update_conversation
    AFTER INSERT ON messages FOR EACH ROW
    EXECUTE FUNCTION fn_update_conversation_last_message();

-- Calcular duración de llamada automáticamente al registrar ended_at
CREATE OR REPLACE FUNCTION fn_calculate_call_duration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL
       AND OLD.ended_at IS NULL
       AND NEW.answered_at IS NOT NULL
    THEN
        NEW.duration_seconds :=
            EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_call_duration
    BEFORE UPDATE ON calls FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_call_duration();

-- Actualizar search_vector en mensajes al insertar o modificar el body
CREATE OR REPLACE FUNCTION fn_update_message_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector := to_tsvector('spanish', COALESCE(NEW.body, ''));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_search_vector
    BEFORE INSERT OR UPDATE OF body ON messages FOR EACH ROW
    EXECUTE FUNCTION fn_update_message_search_vector();

-- Actualizar counter de miembros en channel_settings al entrar/salir
CREATE OR REPLACE FUNCTION fn_update_channel_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Se ejecuta tanto en INSERT como en UPDATE (cuando cambia left_at)
    UPDATE channel_settings cs
    SET member_count = (
        SELECT COUNT(*) FROM conversation_members cm
        WHERE cm.conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id)
          AND cm.left_at IS NULL
    )
    WHERE cs.conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_channel_member_count
    AFTER INSERT OR UPDATE OF left_at ON conversation_members FOR EACH ROW
    EXECUTE FUNCTION fn_update_channel_member_count();

-- =============================================================================
-- FK CIRCULAR (conversation <-> messages, se agrega al final)
-- =============================================================================

ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_last_message
    FOREIGN KEY (last_message_id) REFERENCES messages(id)
    DEFERRABLE INITIALLY DEFERRED;

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

-- Roles del sistema
INSERT INTO roles (name, display_name, description, is_system, priority) VALUES
    ('super_admin', 'Super Administrador', 'Acceso total sin restricciones', TRUE, 100),
    ('admin',       'Administrador',       'Gestión de usuarios y contenido', TRUE, 80),
    ('moderator',   'Moderador',           'Moderar mensajes y grupos', TRUE, 50),
    ('user',        'Usuario',             'Rol estándar', TRUE, 10),
    ('readonly',    'Solo Lectura',        'Ver pero no escribir', TRUE, 5);

-- Permisos atómicos
INSERT INTO permissions (code, category, description) VALUES
    ('messages.send',          'messages',  'Enviar mensajes de texto'),
    ('messages.send_media',    'messages',  'Enviar imágenes, videos y archivos'),
    ('messages.send_voice',    'messages',  'Enviar notas de voz'),
    ('messages.delete_own',    'messages',  'Eliminar propios mensajes'),
    ('messages.delete_any',    'messages',  'Eliminar mensajes de cualquier usuario'),
    ('messages.edit',          'messages',  'Editar propios mensajes'),
    ('calls.make_voice',       'calls',     'Iniciar llamadas de voz'),
    ('calls.make_video',       'calls',     'Iniciar videollamadas'),
    ('calls.make_conference',  'calls',     'Iniciar conferencias grupales'),
    ('calls.record',           'calls',     'Grabar llamadas'),
    ('groups.create',          'groups',    'Crear grupos y canales'),
    ('groups.manage_own',      'groups',    'Administrar grupos propios'),
    ('groups.manage_any',      'groups',    'Administrar cualquier grupo'),
    ('groups.invite',          'groups',    'Invitar usuarios a grupos'),
    ('broadcast.create',       'broadcast', 'Crear listas de difusión'),
    ('broadcast.send',         'broadcast', 'Enviar mensajes de difusión'),
    ('media.upload',           'media',     'Subir archivos al sistema'),
    ('media.delete_own',       'media',     'Eliminar propios archivos'),
    ('media.delete_any',       'media',     'Eliminar archivos de cualquier usuario'),
    ('admin.users',            'admin',     'Gestionar usuarios'),
    ('admin.settings',         'admin',     'Cambiar configuración del sistema'),
    ('admin.view_audit',       'admin',     'Ver logs de auditoría'),
    ('admin.storage',          'admin',     'Ver y gestionar el almacenamiento MinIO');

-- Mapeo rol → permisos (sin esto ningún usuario tendría permisos efectivos)
-- super_admin y admin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

-- moderator: permisos estándar + moderación de contenido
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
    'messages.send', 'messages.send_media', 'messages.send_voice',
    'messages.delete_own', 'messages.edit', 'messages.delete_any',
    'calls.make_voice', 'calls.make_video', 'calls.make_conference', 'calls.record',
    'groups.create', 'groups.manage_own', 'groups.manage_any', 'groups.invite',
    'broadcast.create', 'broadcast.send',
    'media.upload', 'media.delete_own', 'media.delete_any'
)
WHERE r.name = 'moderator'
ON CONFLICT DO NOTHING;

-- user: permisos estándar de un empleado
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
    'messages.send', 'messages.send_media', 'messages.send_voice',
    'messages.delete_own', 'messages.edit',
    'calls.make_voice', 'calls.make_video', 'calls.make_conference',
    'groups.create', 'groups.manage_own', 'groups.invite',
    'broadcast.create', 'broadcast.send',
    'media.upload', 'media.delete_own'
)
WHERE r.name = 'user'
ON CONFLICT DO NOTHING;

-- Configuración del sistema incluyendo parámetros de MinIO
INSERT INTO system_settings (key, value, description, category) VALUES
    -- MinIO / Object Storage
    ('storage_endpoint',           '"http://minio.intranet:9000"',
     'URL interna del servidor MinIO', 'storage'),
    ('storage_region',             '"us-east-1"',
     'Región configurada en MinIO (puede ser cualquier string)', 'storage'),
    ('storage_bucket_images',      '"messaging-images"',     'Bucket para imágenes', 'storage'),
    ('storage_bucket_videos',      '"messaging-videos"',     'Bucket para videos', 'storage'),
    ('storage_bucket_audio',       '"messaging-audio"',      'Bucket para audios y voicenotes', 'storage'),
    ('storage_bucket_documents',   '"messaging-documents"',  'Bucket para documentos', 'storage'),
    ('storage_bucket_thumbnails',  '"messaging-thumbnails"', 'Bucket para previews generados', 'storage'),
    ('storage_bucket_recordings',  '"messaging-recordings"', 'Bucket para grabaciones de llamadas', 'storage'),
    ('storage_bucket_avatars',     '"messaging-avatars"',    'Bucket para avatares', 'storage'),
    ('storage_bucket_stickers',    '"messaging-stickers"',   'Bucket para packs de stickers', 'storage'),
    ('presigned_url_ttl_seconds',  '3600',
     'TTL de las presigned URLs generadas (en segundos)', 'storage'),
    ('presigned_url_cache_seconds','3300',
     'Tiempo que se cachea la URL antes de regenerar (menor que ttl)', 'storage'),
    -- Límites de archivos
    ('max_image_size_mb',          '20',     'Tamaño máximo de imágenes en MB', 'media'),
    ('max_video_size_mb',          '500',    'Tamaño máximo de videos en MB', 'media'),
    ('max_audio_size_mb',          '50',     'Tamaño máximo de audios en MB', 'media'),
    ('max_document_size_mb',       '100',    'Tamaño máximo de documentos en MB', 'media'),
    ('max_voice_duration_seconds', '300',    'Duración máxima de notas de voz en segundos', 'media'),
    ('allowed_mime_types',
     '["image/jpeg","image/png","image/gif","image/webp","video/mp4","video/webm","audio/ogg","audio/mpeg","audio/aac","audio/webm","application/pdf","application/zip","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]',
     'MIME types permitidos para subida', 'media'),
    -- Grupos y general
    ('max_group_members',          '500',   'Máximo de miembros por grupo', 'groups'),
    ('call_recording_enabled',     'false', 'Habilitar grabación de llamadas', 'calls'),
    ('require_call_consent',       'true',  'Requerir consentimiento explícito para grabar', 'calls'),
    ('message_retention_days',     '0',     'Días de retención de mensajes (0 = sin límite)', 'general'),
    ('presence_timeout_minutes',   '5',     'Minutos de inactividad para pasar a "away"', 'general'),
    ('max_broadcast_recipients',   '1000',  'Máximo de destinatarios en una difusión', 'broadcast');

-- =============================================================================
-- COMENTARIOS DE TABLAS
-- =============================================================================

COMMENT ON TABLE storage_objects IS
    'Inventario de todos los archivos almacenados en MinIO. '
    'Nunca se guardan rutas de filesystem ni binarios. '
    'El backend construye la URL usando bucket_name + object_key + endpoint de system_settings.';

COMMENT ON TABLE storage_presigned_urls IS
    'Cache de presigned URLs generadas por MinIO/S3. '
    'El backend regenera automáticamente cuando expires_at < NOW(). '
    'TTL configurable en system_settings.presigned_url_ttl_seconds.';

COMMENT ON COLUMN storage_objects.object_key IS
    'Ruta del objeto dentro del bucket. '
    'Convención: {tipo}/{año}/{mes}/{uuid}.{ext} '
    'Ej: images/2026/04/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg '
    'El prefijo permite lifecycle policies y cleanup por fecha en MinIO.';

COMMENT ON COLUMN storage_objects.access_policy IS
    'private = solo accesible via presigned URL (recomendado para media de usuarios). '
    'public = accesible directo por URL (solo para assets públicos como stickers).';

COMMENT ON COLUMN storage_objects.file_hash_sha256 IS
    'Hash SHA-256 del archivo. Antes de subir a MinIO el backend consulta si ya existe '
    'este hash. Si existe, reutiliza el mismo objeto (deduplicación) sin re-subir.';

COMMENT ON TABLE messages IS
    'Todos los mensajes del sistema. '
    'En producción con alto volumen, considerar particionar por sent_at: '
    'PARTITION BY RANGE (sent_at) con particiones mensuales.';

COMMENT ON TABLE audit_log IS
    'Log inmutable de acciones críticas. '
    'En producción ejecutar: REVOKE UPDATE, DELETE ON audit_log FROM app_role;';

-- =============================================================================
-- FIN DEL SCHEMA — v2.0
-- =============================================================================