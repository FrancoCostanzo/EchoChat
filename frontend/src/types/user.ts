/**
 * Contrato de /auth/me, /users/*. Fuente de verdad en el backend:
 * backend/src/models/user.model.ts (UserResponse, UserMinimal).
 *
 * Re-declarado a mano, no importado: frontend/ y backend/ son builds Docker
 * independientes (ver plan de migración a TypeScript del frontend) — hay que
 * mantenerlo sincronizado a mano si el backend cambia esta forma.
 *
 * Las columnas `Date` del backend viajan como string ISO por HTTP/JSON — acá
 * se tipan `string`, no `Date`, en toda esta carpeta.
 */
export interface UserResponse {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone_extension: string | null;
  department: string | null;
  job_title: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  status: string | null;
  presence: string | null;
  presence_message: string | null;
  /** Estado de ausencia: cuándo vence y si el mensaje se auto-responde en DMs. */
  away_until: string | null;
  auto_reply_enabled: boolean;
  last_seen_at: string | null;
  timezone: string | null;
  locale: string | null;
  auth_provider: string;
  created_at: string | null;
  /** Lo agrega el servicio al resolver la URL prefirmada de MinIO. */
  avatar_url?: string;
}

/**
 * `/auth/me`, `/users/me` y el `user` embebido en el login: a diferencia del
 * resto de los endpoints de usuario (updateProfile, uploadAvatar, ...),
 * userService.getProfile() no devuelve un UserResponse liso — le suma
 * `totp_enabled`, `roles` y `permissions` (ver backend/src/services/user.service.ts).
 */
export interface AuthenticatedUser extends UserResponse {
  totp_enabled: boolean;
  roles: string[];
  permissions: string[];
}

/** Versión reducida para listados y para incrustar en otras respuestas. */
export interface UserMinimal {
  id: string;
  username: string;
  display_name: string;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
}

/** PUT /users/me. Fuente: backend/src/dtos/auth.dto.ts (UpdateProfileRequest). */
export interface UpdateProfileRequest {
  display_name?: string;
  email?: string | null;
  phone_extension?: string | null;
  department?: string | null;
  job_title?: string | null;
  presence?: Presence;
  presence_message?: string | null;
  timezone?: string;
  locale?: string;
}

export type Presence = 'online' | 'offline' | 'away' | 'busy' | 'dnd';

/** PUT /users/me/away. Fuente: backend/src/dtos/auth.dto.ts (AwayStateRequest). */
export interface AwayStateRequest {
  message: string;
  /** ISO. Sin fecha, la ausencia dura hasta que se limpie a mano. */
  until?: string | null;
  auto_reply?: boolean;
}
