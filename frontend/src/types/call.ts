/**
 * Contrato de /calls. Fuente de verdad en el backend:
 * backend/src/models/call.model.ts (toCallResponse, toCallParticipantResponse,
 * toCallHistoryItem) y backend/src/dtos/call.dto.ts (requests). Ver la nota
 * de sincronización en types/user.ts.
 */
export type CallType = 'voice' | 'video' | 'screen_share' | 'conference';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'failed';
export type CallEndReason = 'hangup' | 'timeout' | 'no_answer' | 'error' | 'rejected';
export type ParticipantStatus = 'ringing' | 'joined' | 'left' | 'rejected' | 'no_answer' | 'busy';
export interface CallResponse {
  id: string;
  conversation_id: string;
  type: string;
  status: string;
  initiated_by: string;
  initiated_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: string | null;
  is_encrypted: boolean;
  participants: unknown[];
  created_at: string | null;
}

export interface CallParticipantResponse {
  id: string;
  call_id: string;
  user_id: string;
  status: string;
  can_speak: boolean;
  can_video: boolean;
  can_share_screen: boolean;
  is_muted_by_host: boolean;
  joined_at: string | null;
  left_at: string | null;
}

/** Fila del historial global: aplana el nombre a mostrar. */
export interface CallHistoryItem {
  id: string;
  conversation_id: string;
  conversation_type: string | null;
  type: string;
  status: string;
  initiated_by: string;
  initiated_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: string | null;
  display_name: string | null;
  avatar_key: string | null;
}

export interface InitiateCallRequest {
  conversation_id?: string | null;
  type: CallType;
  participant_ids: string[];
}

export interface UpdateCallStatusRequest {
  status: CallStatus;
  /** Obligatorio cuando el estado es 'ended'. */
  end_reason?: CallEndReason | null;
}

export interface UpdateParticipantRequest {
  status?: ParticipantStatus;
  can_speak?: boolean;
  can_video?: boolean;
  can_share_screen?: boolean;
  is_muted_by_host?: boolean;
}
