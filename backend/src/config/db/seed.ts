import type { Kysely } from 'kysely';
import type { DB } from '../../types/db';
import { insertIgnore } from './upsert';
import { isPostgres } from './schema';

// =============================================================================
// SEED — Datos de referencia del sistema (idempotente).
//
// No son datos de ejemplo: son los que la aplicación necesita para funcionar
// (roles, permisos, su mapeo y la configuración por defecto). Antes vivía en
// docs/seed.sql; acá se escribe una vez para todos los motores.
//
// Sólo inserta lo que falta, así que se corre en CADA arranque para converger:
// un permiso o setting nuevo agregado acá llega solo a las instancias existentes.
//
// Reglas al editar:
//   - Agregar filas nuevas es seguro (se insertan donde falten).
//   - NO renombres/borres códigos de permiso ya usados por el código.
//   - Los permisos nuevos se asignan solos a super_admin/admin.
// =============================================================================

const ROLES = [
  { name: 'super_admin', display_name: 'Super Administrador', description: 'Acceso total sin restricciones', is_system: true, priority: 100 },
  { name: 'admin', display_name: 'Administrador', description: 'Gestión de usuarios y contenido', is_system: true, priority: 80 },
  { name: 'moderator', display_name: 'Moderador', description: 'Moderar mensajes y grupos', is_system: true, priority: 50 },
  { name: 'user', display_name: 'Usuario', description: 'Rol estándar', is_system: true, priority: 10 },
  { name: 'readonly', display_name: 'Solo Lectura', description: 'Ver pero no escribir', is_system: true, priority: 5 },
];

const PERMISSIONS = [
  { code: 'messages.send', category: 'messages', description: 'Enviar mensajes de texto' },
  { code: 'messages.send_media', category: 'messages', description: 'Enviar imágenes, videos y archivos' },
  { code: 'messages.send_voice', category: 'messages', description: 'Enviar notas de voz' },
  { code: 'messages.delete_own', category: 'messages', description: 'Eliminar propios mensajes' },
  { code: 'messages.delete_any', category: 'messages', description: 'Eliminar mensajes de cualquier usuario' },
  { code: 'messages.edit', category: 'messages', description: 'Editar propios mensajes' },
  { code: 'calls.make_voice', category: 'calls', description: 'Iniciar llamadas de voz' },
  { code: 'calls.make_video', category: 'calls', description: 'Iniciar videollamadas' },
  { code: 'calls.make_conference', category: 'calls', description: 'Iniciar conferencias grupales' },
  { code: 'calls.record', category: 'calls', description: 'Grabar llamadas' },
  { code: 'groups.create', category: 'groups', description: 'Crear grupos y canales' },
  { code: 'groups.manage_own', category: 'groups', description: 'Administrar grupos propios' },
  { code: 'groups.manage_any', category: 'groups', description: 'Administrar cualquier grupo' },
  { code: 'groups.invite', category: 'groups', description: 'Invitar usuarios a grupos' },
  { code: 'broadcast.create', category: 'broadcast', description: 'Crear listas de difusión' },
  { code: 'broadcast.send', category: 'broadcast', description: 'Enviar mensajes de difusión' },
  { code: 'media.upload', category: 'media', description: 'Subir archivos al sistema' },
  { code: 'media.delete_own', category: 'media', description: 'Eliminar propios archivos' },
  { code: 'media.delete_any', category: 'media', description: 'Eliminar archivos de cualquier usuario' },
  { code: 'admin.users', category: 'admin', description: 'Gestionar usuarios' },
  { code: 'admin.settings', category: 'admin', description: 'Cambiar configuración del sistema' },
  { code: 'admin.view_audit', category: 'admin', description: 'Ver logs de auditoría' },
  { code: 'admin.storage', category: 'admin', description: 'Ver y gestionar el almacenamiento MinIO' },
];

/** Permisos de cada rol. super_admin y admin reciben TODOS (los nuevos también). */
const USER_PERMISSIONS = [
  'messages.send', 'messages.send_media', 'messages.send_voice',
  'messages.delete_own', 'messages.edit',
  'calls.make_voice', 'calls.make_video', 'calls.make_conference',
  'groups.create', 'groups.manage_own', 'groups.invite',
  'broadcast.create', 'broadcast.send',
  'media.upload', 'media.delete_own',
];
const ROLE_PERMISSIONS: Record<string, string[] | 'all'> = {
  super_admin: 'all',
  admin: 'all',
  // moderator: permisos estándar + moderación de contenido
  moderator: [
    ...USER_PERMISSIONS,
    'messages.delete_any', 'calls.record', 'groups.manage_any', 'media.delete_any',
  ],
  // user: permisos estándar de un empleado
  user: USER_PERMISSIONS,
};

/** `value` es JSON (como texto): la columna es JSON en todos los motores. */
const SETTINGS: { key: string; value: string; description: string; category: string }[] = [
  // MinIO / Object Storage
  { key: 'storage_endpoint', value: '"http://minio.intranet:9000"', description: 'URL interna del servidor MinIO', category: 'storage' },
  { key: 'storage_region', value: '"us-east-1"', description: 'Región configurada en MinIO (puede ser cualquier string)', category: 'storage' },
  { key: 'storage_bucket_images', value: '"messaging-images"', description: 'Bucket para imágenes', category: 'storage' },
  { key: 'storage_bucket_videos', value: '"messaging-videos"', description: 'Bucket para videos', category: 'storage' },
  { key: 'storage_bucket_audio', value: '"messaging-audio"', description: 'Bucket para audios y voicenotes', category: 'storage' },
  { key: 'storage_bucket_documents', value: '"messaging-documents"', description: 'Bucket para documentos', category: 'storage' },
  { key: 'storage_bucket_thumbnails', value: '"messaging-thumbnails"', description: 'Bucket para previews generados', category: 'storage' },
  { key: 'storage_bucket_recordings', value: '"messaging-recordings"', description: 'Bucket para grabaciones de llamadas', category: 'storage' },
  { key: 'storage_bucket_avatars', value: '"messaging-avatars"', description: 'Bucket para avatares', category: 'storage' },
  { key: 'storage_bucket_stickers', value: '"messaging-stickers"', description: 'Bucket para packs de stickers', category: 'storage' },
  { key: 'presigned_url_ttl_seconds', value: '3600', description: 'TTL de las presigned URLs generadas (en segundos)', category: 'storage' },
  { key: 'presigned_url_cache_seconds', value: '3300', description: 'Tiempo que se cachea la URL antes de regenerar (menor que ttl)', category: 'storage' },
  // Límites de archivos
  { key: 'max_image_size_mb', value: '20', description: 'Tamaño máximo de imágenes en MB', category: 'media' },
  { key: 'max_video_size_mb', value: '500', description: 'Tamaño máximo de videos en MB', category: 'media' },
  { key: 'max_audio_size_mb', value: '50', description: 'Tamaño máximo de audios en MB', category: 'media' },
  { key: 'max_document_size_mb', value: '100', description: 'Tamaño máximo de documentos en MB', category: 'media' },
  { key: 'max_voice_duration_seconds', value: '300', description: 'Duración máxima de notas de voz en segundos', category: 'media' },
  {
    key: 'allowed_mime_types',
    value: JSON.stringify([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/ogg', 'audio/mpeg',
      'audio/aac', 'audio/webm', 'application/pdf', 'application/zip', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]),
    description: 'MIME types permitidos para subida',
    category: 'media',
  },
  // Grupos y general
  { key: 'max_group_members', value: '500', description: 'Máximo de miembros por grupo', category: 'groups' },
  { key: 'call_recording_enabled', value: 'false', description: 'Habilitar grabación de llamadas', category: 'calls' },
  { key: 'require_call_consent', value: 'true', description: 'Requerir consentimiento explícito para grabar', category: 'calls' },
  { key: 'message_retention_days', value: '0', description: 'Días de retención de mensajes (0 = sin límite)', category: 'general' },
  { key: 'presence_timeout_minutes', value: '5', description: 'Minutos de inactividad para pasar a "away"', category: 'general' },
  { key: 'message_edit_window_minutes', value: '15', description: 'Minutos para editar un mensaje propio (0 = sin límite)', category: 'messages' },
  { key: 'message_delete_window_minutes', value: '15', description: 'Minutos para eliminar un mensaje propio (0 = sin límite)', category: 'messages' },
  { key: 'max_broadcast_recipients', value: '1000', description: 'Máximo de destinatarios en una difusión', category: 'broadcast' },
  // Seguridad / altas
  { key: 'allow_registration', value: 'true', description: 'Permitir el auto-registro público de usuarios (POST /auth/register)', category: 'security' },
  // Notificaciones
  { key: 'notifications_push_enabled', value: 'true', description: 'Permitir notificaciones push en la instancia', category: 'notifications' },
  { key: 'notifications_email_enabled', value: 'true', description: 'Permitir notificaciones por email en la instancia (requiere SMTP)', category: 'notifications' },
  {
    key: 'notification_defaults',
    value: '{}',
    description: 'Valores por defecto por evento para usuarios que no los cambiaron: {"evento": {"in_app": bool, "push": bool, "email": bool}}',
    category: 'notifications',
  },
  {
    key: 'notification_locked_events',
    value: '["security.alert"]',
    description: 'Eventos que el usuario no puede desactivar ni silenciar (usan los valores por defecto)',
    category: 'notifications',
  },
];

/** Aplica los datos de referencia. Cada paso inserta sólo lo que falta. */
export async function runSeed(db: Kysely<DB>): Promise<void> {
  await insertIgnore(db, 'roles', ROLES);
  await insertIgnore(db, 'permissions', PERMISSIONS);

  // Rol → permisos: NOT EXISTS hace que valga en cualquier motor; en PostgreSQL
  // además queda ON CONFLICT por si dos instancias arrancan a la vez.
  for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
    await db.insertInto('role_permissions')
      .columns(['role_id', 'permission_id'])
      .expression((eb) => {
        let q = eb.selectFrom('roles as r').innerJoin('permissions as p', (j) => j.onTrue())
          .select(['r.id', 'p.id as permission_id'])
          .where('r.name', '=', role)
          .where(({ not, exists, selectFrom }) => not(exists(selectFrom('role_permissions as rp').select('rp.role_id')
            .whereRef('rp.role_id', '=', 'r.id').whereRef('rp.permission_id', '=', 'p.id'))));
        if (codes !== 'all') q = q.where('p.code', 'in', codes);
        return q;
      })
      .$if(isPostgres(), (q) => q.onConflict((oc) => oc.doNothing()))
      .execute();
  }

  await insertIgnore(db, 'system_settings', SETTINGS);

  // Backfill: todo usuario sin ningún rol recibe 'user'. Red de seguridad para
  // usuarios creados antes de tener RBAC o importados sin rol.
  await db.insertInto('user_roles')
    .columns(['user_id', 'role_id'])
    .expression((eb) => eb.selectFrom('users as u').innerJoin('roles as r', (j) => j.onTrue())
      .select(['u.id', 'r.id as role_id'])
      .where('r.name', '=', 'user')
      .where((w) => w.not(w.exists(
        w.selectFrom('user_roles as ur').select('ur.user_id').whereRef('ur.user_id', '=', 'u.id'),
      ))))
    .$if(isPostgres(), (q) => q.onConflict((oc) => oc.doNothing()))
    .execute();
}
