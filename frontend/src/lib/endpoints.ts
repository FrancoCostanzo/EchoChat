import { api, type ApiEnvelope, type ApiMessageEnvelope, type ApiStatusEnvelope, type ApiParams } from './api';
import type {
  RegisterRequest, LoginRequest, LoginResponse, AuthSuccessResponse,
  ChangePasswordRequest, TotpChallengeRequest, TotpCodeRequest, TotpDisableRequest,
  SessionResponse, Setup2faResponse, BackupCodesResponse,
} from '@/types/auth';
import type { UserResponse, UpdateProfileRequest, AuthenticatedUser, AwayStateRequest } from '@/types/user';
import type {
  ScheduledMessageResponse, ScheduleMessageRequest, ReminderResponse, CreateReminderRequest,
} from '@/types/scheduled';
import type {
  DashboardData, SystemStatus, DetailedPoolStats, SystemMetricsResponse, SnapshotHistory,
} from '@/types/monitoring';
import type {
  ConversationResponse, MemberResponse, CreateConversationRequest,
  UpdateConversationRequest, AddMembersRequest, UpdateMemberRequest,
} from '@/types/conversation';
import type {
  ChannelResponse, JoinRequestResponse, CreateChannelRequest,
  UpdateChannelSettingsRequest, JoinChannelRequest,
} from '@/types/channel';
import type {
  MessageResponse, SavedMessageResponse, DraftResponse, MessageReaction, MessageThread,
  SendMessageRequest, UpdateMessageRequest, DraftRequest, PaginationRequest,
} from '@/types/message';
import type { CreatePollRequest, PollResponse } from '@/types/poll';
import type { CreateGameRequest, GameMoveRequest, GameResponse } from '@/types/game';
import type {
  CallResponse, CallParticipantResponse, CallHistoryItem,
  InitiateCallRequest, UpdateCallStatusRequest, UpdateParticipantRequest,
} from '@/types/call';
import type { StorageObjectResponse, UploadMetadataRequest } from '@/types/storage';
import type {
  UserStickerResponse, StickerPackResponse, StickerCollection, UpdateStickerRequest,
} from '@/types/sticker';
import type {
  AdminUserResponse, SettingResponse, StorageObjectAdminResponse,
  AdminCreateUserRequest, AdminUpdateUserRequest,
  RoleResponse, LdapStatus, LdapSyncSummary, IntegrationsResponse,
  AuditLogResult, StorageStatsResponse,
} from '@/types/admin';
import type {
  CreateBroadcastListRequest, SendBroadcastRequest, AddBroadcastRecipientsRequest,
  BroadcastListResponse, BroadcastRecipient, BroadcastMessageResponse, BroadcastDeliveryDetail,
} from '@/types/broadcast';
import type { NotificationPrefsRequest, NotificationPreferenceResponse } from '@/types/notification';
import type { RelationshipRequest, RelationshipEntry } from '@/types/relationship';
import type { UpsertWallpaperRequest, WallpaperEntry } from '@/types/wallpaper';

export const authApi = {
  register: (data: RegisterRequest) => api.post<ApiEnvelope<UserResponse>>('/auth/register', data),
  getRegistrationStatus: () => api.get<ApiEnvelope<{ allow_registration: boolean }>>('/auth/registration-status'),
  login: (data: LoginRequest) => api.post<ApiEnvelope<LoginResponse>>('/auth/login', data),
  logout: () => api.post<ApiMessageEnvelope>('/auth/logout'),
  logoutAll: (keepCurrent = false) => api.post<ApiMessageEnvelope>(`/auth/logout-all${keepCurrent ? '?keepCurrent=true' : ''}`),
  me: () => api.get<ApiEnvelope<AuthenticatedUser>>('/auth/me'),
  changePassword: (data: ChangePasswordRequest) => api.put<ApiMessageEnvelope>('/auth/password', data),
  getSessions: () => api.get<ApiEnvelope<SessionResponse[]>>('/auth/sessions'),
  revokeSession: (id: string) => api.delete<ApiMessageEnvelope>(`/auth/sessions/${id}`),
  // 2FA
  setup2fa: () => api.post<ApiEnvelope<Setup2faResponse>>('/auth/2fa/setup'),
  enable2fa: (code: string) => api.post<ApiEnvelope<BackupCodesResponse>>('/auth/2fa/enable', { code } satisfies TotpCodeRequest),
  disable2fa: (password: string, code: string) => api.post<ApiMessageEnvelope>('/auth/2fa/disable', { password, code } satisfies TotpDisableRequest),
  verify2faChallenge: (data: TotpChallengeRequest) => api.post<ApiEnvelope<AuthSuccessResponse>>('/auth/2fa/challenge', data),
  regenerateBackupCodes: (code: string) => api.post<ApiEnvelope<BackupCodesResponse>>('/auth/2fa/backup-codes/regenerate', { code } satisfies TotpCodeRequest),
  // SSO: la lista es un fetch normal; el login es una navegación top-level del navegador.
  ssoProviders: () => api.get<ApiEnvelope<{ providers: unknown[] }>>('/auth/sso/providers'),
  ssoLoginUrl: (provider: string) => `/api/auth/sso/${provider}/login`,
};

export const usersApi = {
  me: () => api.get<ApiEnvelope<AuthenticatedUser>>('/users/me'),
  updateProfile: (data: UpdateProfileRequest) => api.put<ApiEnvelope<UserResponse>>('/users/me', data),
  uploadAvatar: (file: File) => api.upload<ApiEnvelope<UserResponse>>('/users/me/avatar', file),
  updatePresence: (presence: string) => api.put<ApiEnvelope<UserResponse>>('/users/me/presence', { presence }),
  setAway: (data: AwayStateRequest) => api.put<ApiEnvelope<UserResponse>>('/users/me/away', data),
  clearAway: () => api.delete<ApiEnvelope<UserResponse>>('/users/me/away'),
  search: (q: string, limit = 20, offset = 0) => api.get<ApiEnvelope<UserResponse[]>>('/users/search', { q, limit, offset }),
  getById: (id: string) => api.get<ApiEnvelope<UserResponse>>(`/users/${id}`),
};

export const scheduledApi = {
  schedule: (data: ScheduleMessageRequest) => api.post<ApiEnvelope<ScheduledMessageResponse>>('/scheduled/messages', data),
  listScheduled: () => api.get<ApiEnvelope<ScheduledMessageResponse[]>>('/scheduled/messages'),
  cancelScheduled: (id: string) => api.delete<ApiEnvelope<ScheduledMessageResponse>>(`/scheduled/messages/${id}`),
  remind: (data: CreateReminderRequest) => api.post<ApiEnvelope<ReminderResponse>>('/scheduled/reminders', data),
  listReminders: () => api.get<ApiEnvelope<ReminderResponse[]>>('/scheduled/reminders'),
  cancelReminder: (id: string) => api.delete<ApiEnvelope<ReminderResponse>>(`/scheduled/reminders/${id}`),
};

export const conversationsApi = {
  create: (data: CreateConversationRequest) => api.post<ApiEnvelope<ConversationResponse>>('/conversations', data),
  list: (limit = 50, offset = 0) => api.get<ApiEnvelope<ConversationResponse[]>>('/conversations', { limit, offset }),
  getById: (id: string) => api.get<ApiEnvelope<ConversationResponse>>(`/conversations/${id}`),
  update: (id: string, data: UpdateConversationRequest) => api.put<ApiEnvelope<ConversationResponse>>(`/conversations/${id}`, data),
  addMembers: (id: string, memberIds: string[]) => api.post<ApiEnvelope<MemberResponse[]>>(`/conversations/${id}/members`, { member_ids: memberIds } satisfies AddMembersRequest),
  getMembers: (id: string, limit = 100, offset = 0) => api.get<ApiEnvelope<MemberResponse[]>>(`/conversations/${id}/members`, { limit, offset }),
  updateMember: (convId: string, userId: string, data: UpdateMemberRequest) => api.put<ApiEnvelope<MemberResponse>>(`/conversations/${convId}/members/${userId}`, data),
  removeMember: (convId: string, userId: string) => api.delete<ApiMessageEnvelope>(`/conversations/${convId}/members/${userId}`),
  markAsRead: (id: string, messageId?: string) => api.post<ApiMessageEnvelope>(`/conversations/${id}/read`, messageId ? { message_id: messageId } : {}),
  uploadAvatar: (id: string, file: File) => api.upload<ApiEnvelope<ConversationResponse>>(`/conversations/${id}/avatar`, file),
  removeAvatar: (id: string) => api.delete<ApiEnvelope<ConversationResponse>>(`/conversations/${id}/avatar`),
};

export const channelsApi = {
  create: (data: CreateChannelRequest) => api.post<ApiEnvelope<ChannelResponse>>('/channels', data),
  discover: (params?: ApiParams) => api.get<ApiEnvelope<ChannelResponse[]>>('/channels/discover', params),
  getById: (id: string) => api.get<ApiEnvelope<ChannelResponse>>(`/channels/${id}`),
  updateSettings: (id: string, data: UpdateChannelSettingsRequest) => api.put<ApiEnvelope<ChannelResponse>>(`/channels/${id}/settings`, data),
  join: (id: string, message?: string) => api.post<ApiEnvelope<unknown>>(`/channels/${id}/join`, message ? ({ message } satisfies JoinChannelRequest) : {}),
  listRequests: (id: string, params?: ApiParams) => api.get<ApiEnvelope<JoinRequestResponse[]>>(`/channels/${id}/requests`, params),
  reviewRequest: (id: string, requestId: string, status: 'approved' | 'rejected') => api.put<ApiEnvelope<JoinRequestResponse>>(`/channels/${id}/requests/${requestId}`, { status }),
};

export const messagesApi = {
  send: (data: SendMessageRequest) => api.post<ApiEnvelope<MessageResponse>>('/messages', data),
  getById: (id: string) => api.get<ApiEnvelope<MessageResponse>>(`/messages/${id}`),
  getThread: (id: string) => api.get<ApiEnvelope<MessageThread>>(`/messages/${id}/thread`),
  getInfo: (id: string) => api.get<ApiEnvelope<unknown>>(`/messages/${id}/info`),
  edit: (id: string, data: UpdateMessageRequest) => api.put<ApiEnvelope<MessageResponse>>(`/messages/${id}`, data),
  delete: (id: string) => api.delete<ApiEnvelope<MessageResponse>>(`/messages/${id}`),
  addReaction: (id: string, emoji: string) => api.post<ApiEnvelope<MessageReaction[]>>(`/messages/${id}/reactions`, { emoji }),
  removeReaction: (id: string, emoji: string) => api.delete<ApiEnvelope<MessageReaction[]>>(`/messages/${id}/reactions/${emoji}`),
  addReceipt: (id: string) => api.post<ApiEnvelope<unknown>>(`/messages/${id}/receipts`),
  getByConversation: (convId: string, params?: PaginationRequest) => api.get<ApiEnvelope<MessageResponse[]>>(`/messages/conversation/${convId}`, params as ApiParams),
  search: (convId: string, q: string, limit = 20) => api.get<ApiEnvelope<MessageResponse[]>>(`/messages/conversation/${convId}/search`, { q, limit }),
  getPinned: (convId: string) => api.get<ApiEnvelope<MessageResponse[]>>(`/messages/conversation/${convId}/pinned`),
  pin: (convId: string, msgId: string) => api.post<ApiMessageEnvelope>(`/messages/conversation/${convId}/pin/${msgId}`),
  unpin: (convId: string, msgId: string) => api.delete<ApiMessageEnvelope>(`/messages/conversation/${convId}/pin/${msgId}`),
  // Forwarding
  forward: (msgId: string, conversationIds: string[]) => api.post<ApiEnvelope<MessageResponse[]>>(`/messages/${msgId}/forward`, { conversation_ids: conversationIds }),
  // Saved messages
  listSaved: (params?: ApiParams) => api.get<ApiEnvelope<SavedMessageResponse[]>>('/messages/saved', params),
  save: (msgId: string, note?: string) => api.post<ApiEnvelope<SavedMessageResponse>>(`/messages/${msgId}/save`, note ? { note } : {}),
  unsave: (msgId: string) => api.delete<ApiMessageEnvelope>(`/messages/${msgId}/save`),
  // Drafts
  listDrafts: () => api.get<ApiEnvelope<DraftResponse[]>>('/messages/drafts'),
  getDraft: (convId: string) => api.get<ApiEnvelope<DraftResponse>>(`/messages/conversation/${convId}/draft`),
  saveDraft: (convId: string, data: DraftRequest) => api.put<ApiEnvelope<DraftResponse>>(`/messages/conversation/${convId}/draft`, data),
  deleteDraft: (convId: string) => api.delete<ApiMessageEnvelope>(`/messages/conversation/${convId}/draft`),
};

export const pollsApi = {
  create: (data: CreatePollRequest) => api.post<ApiEnvelope<MessageResponse>>('/polls', data),
  vote: (pollId: string, optionIds: string[]) => api.post<ApiEnvelope<PollResponse>>(`/polls/${pollId}/vote`, { option_ids: optionIds }),
  retract: (pollId: string) => api.delete<ApiEnvelope<PollResponse>>(`/polls/${pollId}/vote`),
  close: (pollId: string) => api.post<ApiEnvelope<PollResponse>>(`/polls/${pollId}/close`),
};

export const gamesApi = {
  create: (data: CreateGameRequest) => api.post<ApiEnvelope<MessageResponse>>('/games', data),
  move: (gameId: string, data: GameMoveRequest) => api.post<ApiEnvelope<GameResponse>>(`/games/${gameId}/move`, data),
};

export const callsApi = {
  create: (data: InitiateCallRequest) => api.post<ApiEnvelope<CallResponse>>('/calls', data),
  getById: (id: string) => api.get<ApiEnvelope<CallResponse>>(`/calls/${id}`),
  updateStatus: (id: string, data: UpdateCallStatusRequest) => api.put<ApiEnvelope<CallResponse>>(`/calls/${id}/status`, data),
  updateParticipant: (callId: string, userId: string, data: UpdateParticipantRequest) => api.put<ApiEnvelope<CallParticipantResponse>>(`/calls/${callId}/participants/${userId}`, data),
  getByConversation: (convId: string, limit = 20, offset = 0) => api.get<ApiEnvelope<CallResponse[]>>(`/calls/conversation/${convId}`, { limit, offset }),
  getActive: () => api.get<ApiEnvelope<CallResponse[]>>('/calls/active'),
  getHistory: (params?: ApiParams) => api.get<ApiEnvelope<CallHistoryItem[]>>('/calls/history', params),
};

export const storageApi = {
  upload: (file: File, objectType: string, extra: Record<string, string | number | boolean | undefined> = {}) =>
    api.upload<ApiEnvelope<StorageObjectResponse>>('/storage/upload', file, { object_type: objectType, ...extra }),
  getUploadUrl: (data: UploadMetadataRequest) => api.post<ApiEnvelope<unknown>>('/storage/upload-url', data),
  getById: (id: string) => api.get<ApiEnvelope<StorageObjectResponse>>(`/storage/${id}`),
  getUrl: (id: string) => api.get<ApiEnvelope<{ url: string }>>(`/storage/${id}/url`),
  delete: (id: string) => api.delete<ApiMessageEnvelope>(`/storage/${id}`),
};

// Personal sticker collection: packs, keywords, favorites, recents.
export const stickerApi = {
  list: (search?: string) => api.get<ApiEnvelope<StickerCollection>>('/stickers', search ? { search } : undefined),
  upload: (file: File, extra: Record<string, string | number | boolean | undefined> = {}) => api.upload<ApiEnvelope<UserStickerResponse>>('/stickers/upload', file, extra),
  save: (objectId: string) => api.post<ApiEnvelope<UserStickerResponse>>('/stickers/save', { object_id: objectId }),
  update: (id: string, data: UpdateStickerRequest) => api.patch<ApiEnvelope<UserStickerResponse>>(`/stickers/${id}`, data),
  remove: (id: string) => api.delete<ApiMessageEnvelope>(`/stickers/${id}`),
  use: (id: string) => api.post<ApiStatusEnvelope>(`/stickers/${id}/use`),
  createPack: (name: string) => api.post<ApiEnvelope<StickerPackResponse>>('/stickers/packs', { name }),
  renamePack: (id: string, name: string) => api.patch<ApiEnvelope<StickerPackResponse>>(`/stickers/packs/${id}`, { name }),
  deletePack: (id: string) => api.delete<ApiMessageEnvelope>(`/stickers/packs/${id}`),
};

export const broadcastsApi = {
  create: (data: CreateBroadcastListRequest) => api.post<ApiEnvelope<BroadcastListResponse>>('/broadcasts', data),
  list: () => api.get<ApiEnvelope<BroadcastListResponse[]>>('/broadcasts'),
  getById: (id: string) => api.get<ApiEnvelope<BroadcastListResponse>>(`/broadcasts/${id}`),
  getMessages: (listId: string) => api.get<ApiEnvelope<BroadcastMessageResponse[]>>(`/broadcasts/${listId}/messages`),
  getDeliveries: (listId: string, messageId: string) => api.get<ApiEnvelope<BroadcastDeliveryDetail[]>>(`/broadcasts/${listId}/messages/${messageId}/deliveries`),
  addRecipients: (listId: string, data: AddBroadcastRecipientsRequest) => api.post<ApiEnvelope<BroadcastRecipient[]>>(`/broadcasts/${listId}/recipients`, data),
  removeRecipient: (listId: string, userId: string) => api.delete<ApiMessageEnvelope>(`/broadcasts/${listId}/recipients/${userId}`),
  sendMessage: (listId: string, data: SendBroadcastRequest) => api.post<ApiEnvelope<unknown>>(`/broadcasts/${listId}/messages`, data),
};

export const notificationsApi = {
  list: (params?: ApiParams) => api.get<ApiEnvelope<unknown[]>>('/notifications', params),
  getUnreadCount: () => api.get<ApiEnvelope<{ count: number }>>('/notifications/count'),
  readAll: () => api.post<ApiMessageEnvelope>('/notifications/read-all'),
  read: (id: string) => api.put<ApiEnvelope<unknown>>(`/notifications/${id}/read`),
  getPreferences: () => api.get<ApiEnvelope<NotificationPreferenceResponse[]>>('/notifications/preferences'),
  updatePreferences: (data: NotificationPrefsRequest) => api.put<ApiEnvelope<NotificationPreferenceResponse>>('/notifications/preferences', data),
};

export const adminApi = {
  listUsers: (params?: ApiParams) => api.get<ApiEnvelope<AdminUserResponse[]>>('/admin/users', params),
  createUser: (data: AdminCreateUserRequest) => api.post<ApiEnvelope<AdminUserResponse>>('/admin/users', data),
  updateUser: (userId: string, data: AdminUpdateUserRequest) => api.patch<ApiEnvelope<AdminUserResponse>>(`/admin/users/${userId}`, data),
  uploadUserAvatar: (userId: string, file: File) => api.upload<ApiEnvelope<AdminUserResponse>>(`/admin/users/${userId}/avatar`, file),
  removeUserAvatar: (userId: string) => api.delete<ApiEnvelope<AdminUserResponse>>(`/admin/users/${userId}/avatar`),
  disableUser2fa: (userId: string) => api.delete<ApiEnvelope<AdminUserResponse>>(`/admin/users/${userId}/2fa`),
  resetUserPassword: (userId: string, password: string) => api.patch<ApiEnvelope<unknown>>(`/admin/users/${userId}/password`, { password }),
  deleteUser: (userId: string) => api.delete<ApiEnvelope<AdminUserResponse>>(`/admin/users/${userId}`),
  listRoles: () => api.get<ApiEnvelope<RoleResponse[]>>('/admin/roles'),
  getLdapStatus: () => api.get<ApiEnvelope<LdapStatus>>('/admin/ldap/status'),
  syncLdap: () => api.post<ApiEnvelope<LdapSyncSummary>>('/admin/ldap/sync'),
  getIntegrations: () => api.get<ApiEnvelope<IntegrationsResponse>>('/admin/integrations'),
  getSettings: () => api.get<ApiEnvelope<SettingResponse[]>>('/admin/settings'),
  updateSetting: (key: string, value: unknown) => api.put<ApiEnvelope<SettingResponse>>(`/admin/settings/${key}`, { value }),
  getAuditLog: (params?: ApiParams) => api.get<ApiEnvelope<AuditLogResult>>('/admin/audit', params),
  getStorageStats: () => api.get<ApiEnvelope<StorageStatsResponse>>('/admin/storage/stats'),
  listStorageObjects: (params?: ApiParams) => api.get<ApiEnvelope<StorageObjectAdminResponse[]>>('/admin/storage/objects', params),
};

export const relationshipsApi = {
  create: (data: RelationshipRequest) => api.post<ApiEnvelope<unknown>>('/relationships', data),
  remove: (targetId: string, type: string) => api.delete<ApiMessageEnvelope>(`/relationships/${targetId}/${type}`),
  getContacts: () => api.get<ApiEnvelope<RelationshipEntry[]>>('/relationships/contacts'),
  getBlocked: () => api.get<ApiEnvelope<RelationshipEntry[]>>('/relationships/blocked'),
  getFavorites: () => api.get<ApiEnvelope<RelationshipEntry[]>>('/relationships/favorites'),
};

export const wallpaperApi = {
  getAll: () => api.get<ApiEnvelope<WallpaperEntry[]>>('/preferences/wallpapers'),
  upsert: (data: UpsertWallpaperRequest) => api.put<ApiEnvelope<WallpaperEntry>>('/preferences/wallpapers', data),
  remove: (scope: string, scopeKey: string) => api.delete<ApiMessageEnvelope>(`/preferences/wallpapers/${scope}/${encodeURIComponent(scopeKey)}`),
};

export const monitoringApi = {
  getDashboard: () => api.get<ApiEnvelope<DashboardData>>('/monitoring/dashboard'),
  getHealth: () => api.get<ApiEnvelope<SystemStatus>>('/monitoring/health'),
  getDatabase: () => api.get<ApiEnvelope<DetailedPoolStats>>('/monitoring/database'),
  getSystem: () => api.get<ApiEnvelope<SystemMetricsResponse>>('/monitoring/system'),
  getHistory: (range = '24h') => api.get<ApiEnvelope<SnapshotHistory>>('/monitoring/history', { range }),
};
