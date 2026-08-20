import type { UserResponse } from './user';

/**
 * Contrato de /admin/*. Fuente de verdad en el backend:
 * backend/src/models/admin.model.ts (toAdminUserResponse, toSettingResponse,
 * toAuditEntryResponse, toStorageObjectAdminResponse). Ver la nota de
 * sincronización en types/user.ts.
 */
export interface AdminUserResponse extends UserResponse {
  roles: string[];
  totp_enabled: boolean;
}

export interface SettingResponse {
  key: string;
  value: unknown;
  description: string | null;
  category: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** Entrada de auditoría con los datos del actor traídos por el JOIN. */
export interface AuditEntryResponse {
  id: string;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  success: boolean;
  error_message: string | null;
  data_before: unknown;
  data_after: unknown;
  severity: string;
  category: string;
  session_id: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

/** Objeto de storage con el nombre de quien lo subió, traído por el JOIN. */
export interface StorageObjectAdminResponse {
  id: string;
  bucket_name: string;
  object_key: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  object_type: string;
  processing_status: string;
  virus_scan_status: string | null;
  uploader_id: string | null;
  uploader_display_name: string | null;
  uploaded_at: string | null;
}

export interface AdminCreateUserRequest {
  username: string;
  display_name: string;
  email?: string | null;
  password: string;
  department?: string | null;
  job_title?: string | null;
  role_names?: string[];
}

export interface AdminUpdateUserRequest {
  display_name?: string;
  email?: string | null;
  department?: string | null;
  job_title?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
  role_names?: string[];
}

export interface AdminResetPasswordRequest {
  password: string;
}

export interface AdminUpdateSettingRequest {
  /** Los settings guardan valores heterogéneos (string, número, lista, objeto). */
  value: unknown;
}

/** GET /admin/roles. Fuente: backend/src/repositories/user.repository.ts (RoleSummary). */
export interface RoleResponse {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  priority: number | null;
}

/** GET /admin/audit. Fuente: adminService.getAuditLog. */
export interface AuditLogResult {
  entries: AuditEntryResponse[];
  total: number;
}

/** Sub-objeto ldap de GET /admin/integrations y respuesta de POST /admin/ldap/sync. Fuente: ldapService.status(). */
export interface LdapStatus {
  enabled: boolean;
  base_dn: string | null;
  url: string | null;
  sync_enabled: boolean;
  sync_cron: string;
  deprovision: boolean;
  sync_roles: boolean;
}

/** Resumen de una corrida de sincronización LDAP. Fuente: backend/src/services/admin.service.ts (LdapSyncSummary). */
export interface LdapSyncSummary {
  total: number;
  created: number;
  updated: number;
  reactivated: number;
  disabled: number;
  failed: number;
}

export interface SsoProviderInfo {
  name: string;
  label: string;
}

/** GET /admin/integrations. Fuente: adminService.getIntegrations. */
export interface IntegrationsResponse {
  ldap: LdapStatus;
  sso: {
    enabled: boolean;
    providers: SsoProviderInfo[];
  };
  scim: {
    enabled: boolean;
  };
}

/** GET /admin/storage/stats. Fuente: backend/src/repositories/storage.repository.ts (getStats). */
export interface StorageStatsSummary {
  total_objects: number;
  /** bigint de Postgres -> string. */
  total_bytes: string;
  pending_processing: number;
  failed_processing: number;
}

export interface StorageBucketStat {
  bucket_name: string;
  object_count: number;
  total_bytes: string;
}

export interface StorageTypeStat {
  object_type: string;
  object_count: number;
  total_bytes: string;
}

export interface StorageStatsResponse {
  summary: StorageStatsSummary;
  by_bucket: StorageBucketStat[];
  by_type: StorageTypeStat[];
}
