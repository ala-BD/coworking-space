// services/api/messaging.js — Messagerie & Support
import { apiFetch } from './_core';

export const messagingApi = {
  getConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/conversations?${qs}`);
  },
  createConversation: (payload) =>
    apiFetch('/api/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  getConversation: (id) => apiFetch(`/api/conversations/${id}`),
  getMessages: (convId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/conversations/${convId}/messages?${qs}`);
  },
  sendMessage: (convId, content) =>
    apiFetch(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  markAsRead: (convId) =>
    apiFetch(`/api/conversations/${convId}/read`, { method: 'PATCH' }),
  getUnreadCount: () => apiFetch('/api/messages/unread-count'),
  // Admin
  getAdminConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/admin/conversations?${qs}`);
  },
  createAdminConversation: (payload) =>
    apiFetch('/api/admin/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  searchMembers: (search) =>
    apiFetch(`/api/admin/members?search=${encodeURIComponent(search)}`),
};
