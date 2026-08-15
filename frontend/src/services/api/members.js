// services/api/members.js — Membres & Comptes
import { apiFetch } from './_core';

export const memberApi = {
  getMe: () => apiFetch('/api/members/me'),
  updateMe: (payload) => apiFetch('/api/members/me', { method: 'PUT', body: JSON.stringify(payload) }),
  addDocument: (payload) =>
    apiFetch('/api/members/me/documents', { method: 'POST', body: JSON.stringify(payload) }),
  removeDocument: (index) =>
    apiFetch(`/api/members/me/documents/${index}`, { method: 'DELETE' }),
  getQr: () => apiFetch('/api/members/me/qr'),
  getAll: () => apiFetch('/api/members'),
  getById: (id) => apiFetch(`/api/members/${id}`),
  updateById: (id, payload) =>
    apiFetch(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getPendingAccounts: () => apiFetch('/api/admin/pending-accounts'),
  approveAccount: (id, action) =>
    apiFetch(`/api/admin/approve-account/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
};
