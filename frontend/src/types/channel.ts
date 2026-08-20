/**
 * Contrato de /channels. Un canal es una conversation (type 'channel') más
 * channel_settings — el backend los fusiona en esta respuesta. Fuente de
 * verdad: backend/src/models/channel.model.ts (toChannelResponse,
 * toJoinRequestResponse) y backend/src/dtos/channel.dto.ts (requests). Ver la
 * nota de sincronización en types/user.ts.
 */
export type ChannelCategory = 'announcements' | 'department' | 'project' | 'general';
export type PostRestriction = 'members' | 'admins_only' | 'owner_only';
export type JoinMode = 'open' | 'invite_only' | 'request';
export interface ChannelResponse {
  id: string;
  name: string | null;
  description: string | null;
  topic: string | null;
  avatar_object_id: string | null;
  max_members: number | null;
  category: string | null;
  is_official: boolean;
  member_count: number;
  post_restriction: string;
  join_mode: string;
  // Solo presentes cuando el viewer es miembro (o tiene una solicitud pendiente).
  is_member?: boolean;
  member_role?: string;
  has_pending_request?: boolean;
  created_at: string | null;
}

export interface JoinRequestResponse {
  id: string;
  conversation_id: string;
  user_id: string;
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  // Datos de usuario, traídos por el JOIN.
  username?: string | null;
  display_name?: string | null;
  avatar_object_key?: string | null;
  department?: string | null;
}

export interface CreateChannelRequest {
  name: string;
  description?: string | null;
  topic?: string | null;
  category?: ChannelCategory | null;
  is_official?: boolean;
  post_restriction?: PostRestriction;
  join_mode?: JoinMode;
  is_discoverable?: boolean;
  max_members?: number | null;
  /** Miembros iniciales además del creador, que queda como owner. */
  member_ids?: string[];
}

export interface UpdateChannelSettingsRequest {
  category?: ChannelCategory | null;
  is_official?: boolean;
  post_restriction?: PostRestriction;
  join_mode?: JoinMode;
}

export interface JoinChannelRequest {
  message?: string | null;
}

export interface ReviewJoinRequestRequest {
  status: 'approved' | 'rejected';
}
