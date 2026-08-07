import type { Row } from '../types/rows';

/**
 * Contrato de la API para un usuario. Es lo que ve el cliente: deliberadamente
 * NO es la fila de la base — quedan afuera columnas internas como `metadata`.
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
  last_seen_at: Date | null;
  timezone: string | null;
  locale: string | null;
  auth_provider: string;
  created_at: Date | null;
  /** Lo agrega el servicio al resolver la URL prefirmada de MinIO. */
  avatar_url?: string;
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

type UserRow = Row<'users'>;

export function toUserResponse(row: UserRow | null | undefined): UserResponse | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    phone_extension: row.phone_extension,
    department: row.department,
    job_title: row.job_title,
    avatar_bucket: row.avatar_bucket,
    avatar_object_key: row.avatar_object_key,
    status: row.status,
    presence: row.presence,
    presence_message: row.presence_message,
    last_seen_at: row.last_seen_at,
    timezone: row.timezone,
    locale: row.locale,
    auth_provider: row.auth_provider || 'local',
    created_at: row.created_at,
  };
}

export function toUserMinimal(row: UserRow | null | undefined): UserMinimal | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_bucket: row.avatar_bucket,
    avatar_object_key: row.avatar_object_key,
    presence: row.presence,
  };
}
