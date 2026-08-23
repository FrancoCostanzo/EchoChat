import type { AuthenticatedUser } from './user';

/**
 * Contrato de /auth/*. Fuente de verdad en el backend:
 * backend/src/dtos/auth.dto.ts y backend/src/controllers/auth.controller.ts
 * (el shape de `data` en login/callback, que no vive en un model.ts propio).
 * Ver la nota de sincronización en types/user.ts.
 */
export type DeviceType = 'web' | 'desktop' | 'mobile' | 'api';

export interface RegisterRequest {
  username: string;
  display_name: string;
  email?: string | null;
  password: string;
  phone_extension?: string | null;
  department?: string | null;
  job_title?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
  device_name?: string | null;
  device_type?: DeviceType;
}

export interface AuthSuccessResponse {
  user: AuthenticatedUser;
  token: string;
  expires_at: string;
}

/** login() y verify2faChallenge() dan uno u otro según si la cuenta tiene 2FA activo. */
export type LoginResponse = { requires_2fa: true; temp_token: string } | AuthSuccessResponse;

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface TotpChallengeRequest {
  temp_token: string;
  code: string;
  device_name?: string | null;
  device_type?: DeviceType;
}

export interface TotpCodeRequest {
  code: string;
}

export interface TotpDisableRequest {
  password: string;
  code: string;
}

/** GET /auth/sessions. Fuente: backend/src/repositories/session.repository.ts (SessionSummary) + auth.controller.ts (agrega is_current). */
export interface SessionResponse {
  id: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string | null;
  created_at: string | null;
  is_current: boolean;
}

/** POST /auth/2fa/setup. Fuente: authService.setupTotp. */
export interface Setup2faResponse {
  secret: string;
  qr_code: string;
  otpauth_url: string;
}

/** POST /auth/2fa/enable y /auth/2fa/backup-codes/regenerate. Fuente: authService.enableTotp / regenerateBackupCodes. */
export interface BackupCodesResponse {
  backup_codes: string[];
}
