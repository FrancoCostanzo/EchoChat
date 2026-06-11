import { api } from './api';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  logoutAll: (keepCurrent = false) => api.post(`/auth/logout-all${keepCurrent ? '?keepCurrent=true' : ''}`),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/password', data),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (id) => api.delete(`/auth/sessions/${id}`),
  // 2FA
  setup2fa: () => api.post('/auth/2fa/setup'),
  enable2fa: (code) => api.post('/auth/2fa/enable', { code }),
  disable2fa: (password, code) => api.post('/auth/2fa/disable', { password, code }),
  verify2faChallenge: (data) => api.post('/auth/2fa/challenge', data),
  regenerateBackupCodes: (code) => api.post('/auth/2fa/backup-codes/regenerate', { code }),
};

export const usersApi = {
  me: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  uploadAvatar: (file) => api.upload('/users/me/avatar', file),
  updatePresence: (presence) => api.put('/users/me/presence', { presence }),
  search: (q, limit = 20, offset = 0) => api.get('/users/search', { q, limit, offset }),
  getById: (id) => api.get(`/users/${id}`),
};

export const conversationsApi = {
  create: (data) => api.post('/conversations', data),
  list: (limit = 50, offset = 0) => api.get('/conversations', { limit, offset }),
  getById: (id) => api.get(`/conversations/${id}`),
  update: (id, data) => api.put(`/conversations/${id}`, data),
  addMembers: (id, memberIds) => api.post(`/conversations/${id}/members`, { member_ids: memberIds }),
  getMembers: (id, limit = 100, offset = 0) => api.get(`/conversations/${id}/members`, { limit, offset }),
  updateMember: (convId, userId, data) => api.put(`/conversations/${convId}/members/${userId}`, data),
  removeMember: (convId, userId) => api.delete(`/conversations/${convId}/members/${userId}`),
  markAsRead: (id, messageId) => api.post(`/conversations/${id}/read`, messageId ? { message_id: messageId } : {}),
};

export const channelsApi = {
  create: (data) => api.post('/channels', data),
  discover: (params) => api.get('/channels/discover', params),
  getById: (id) => api.get(`/channels/${id}`),
  updateSettings: (id, data) => api.put(`/channels/${id}/settings`, data),
  join: (id, message) => api.post(`/channels/${id}/join`, message ? { message } : {}),
  listRequests: (id, params) => api.get(`/channels/${id}/requests`, params),
  reviewRequest: (id, requestId, status) => api.put(`/channels/${id}/requests/${requestId}`, { status }),
};

export const messagesApi = {
  send: (data) => api.post('/messages', data),
  getById: (id) => api.get(`/messages/${id}`),
  getThread: (id) => api.get(`/messages/${id}/thread`),
  edit: (id, body) => api.put(`/messages/${id}`, { body }),
  delete: (id) => api.delete(`/messages/${id}`),
  addReaction: (id, emoji) => api.post(`/messages/${id}/reactions`, { emoji }),
  removeReaction: (id, emoji) => api.delete(`/messages/${id}/reactions/${emoji}`),
  addReceipt: (id) => api.post(`/messages/${id}/receipts`),
  getByConversation: (convId, params) => api.get(`/messages/conversation/${convId}`, params),
  search: (convId, q, limit = 20) => api.get(`/messages/conversation/${convId}/search`, { q, limit }),
  getPinned: (convId) => api.get(`/messages/conversation/${convId}/pinned`),
  pin: (convId, msgId) => api.post(`/messages/conversation/${convId}/pin/${msgId}`),
  unpin: (convId, msgId) => api.delete(`/messages/conversation/${convId}/pin/${msgId}`),
  // Forwarding
  forward: (msgId, conversationIds) => api.post(`/messages/${msgId}/forward`, { conversation_ids: conversationIds }),
  // Saved messages
  listSaved: (params) => api.get('/messages/saved', params),
  save: (msgId, note) => api.post(`/messages/${msgId}/save`, note ? { note } : {}),
  unsave: (msgId) => api.delete(`/messages/${msgId}/save`),
  // Drafts
  listDrafts: () => api.get('/messages/drafts'),
  getDraft: (convId) => api.get(`/messages/conversation/${convId}/draft`),
  saveDraft: (convId, data) => api.put(`/messages/conversation/${convId}/draft`, data),
  deleteDraft: (convId) => api.delete(`/messages/conversation/${convId}/draft`),
};

export const pollsApi = {
  create: (data) => api.post('/polls', data),
  vote: (pollId, optionIds) => api.post(`/polls/${pollId}/vote`, { option_ids: optionIds }),
  retract: (pollId) => api.delete(`/polls/${pollId}/vote`),
  close: (pollId) => api.post(`/polls/${pollId}/close`),
};

export const callsApi = {
  create: (data) => api.post('/calls', data),
  getById: (id) => api.get(`/calls/${id}`),
  updateStatus: (id, data) => api.put(`/calls/${id}/status`, data),
  updateParticipant: (callId, userId, data) => api.put(`/calls/${callId}/participants/${userId}`, data),
  getByConversation: (convId, limit = 20, offset = 0) => api.get(`/calls/conversation/${convId}`, { limit, offset }),
  getActive: () => api.get('/calls/active'),
};

export const storageApi = {
  upload: (file, objectType, extra = {}) => api.upload('/storage/upload', file, { object_type: objectType, ...extra }),
  getUploadUrl: (data) => api.post('/storage/upload-url', data),
  getById: (id) => api.get(`/storage/${id}`),
  getUrl: (id) => api.get(`/storage/${id}/url`),
  delete: (id) => api.delete(`/storage/${id}`),
};

export const broadcastsApi = {
  create: (data) => api.post('/broadcasts', data),
  list: () => api.get('/broadcasts'),
  getById: (id) => api.get(`/broadcasts/${id}`),
  getMessages: (listId) => api.get(`/broadcasts/${listId}/messages`),
  addRecipients: (listId, data) => api.post(`/broadcasts/${listId}/recipients`, data),
  removeRecipient: (listId, userId) => api.delete(`/broadcasts/${listId}/recipients/${userId}`),
  sendMessage: (listId, data) => api.post(`/broadcasts/${listId}/messages`, data),
};

export const notificationsApi = {
  list: (params) => api.get('/notifications', params),
  getUnreadCount: () => api.get('/notifications/count'),
  readAll: () => api.post('/notifications/read-all'),
  read: (id) => api.put(`/notifications/${id}/read`),
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data) => api.put('/notifications/preferences', data),
};

export const adminApi = {
  listUsers: (params) => api.get('/admin/users', params),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (userId, data) => api.patch(`/admin/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
  listRoles: () => api.get('/admin/roles'),
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  getAuditLog: (params) => api.get('/admin/audit', params),
  getStorageStats: () => api.get('/admin/storage/stats'),
  listStorageObjects: (params) => api.get('/admin/storage/objects', params),
};

export const relationshipsApi = {
  create: (data) => api.post('/relationships', data),
  remove: (targetId, type) => api.delete(`/relationships/${targetId}/${type}`),
  getContacts: () => api.get('/relationships/contacts'),
  getBlocked: () => api.get('/relationships/blocked'),
  getFavorites: () => api.get('/relationships/favorites'),
};
