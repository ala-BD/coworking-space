// services/api/sites.js — Multi-sites (Module N)
import { apiFetch } from './_core';

export const sitesApi = {
  getAll: () => apiFetch('/api/sites'),
  create: (payload) =>
    apiFetch('/api/sites', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/sites/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) =>
    apiFetch(`/api/sites/${id}`, { method: 'DELETE' }),
  getMembers: (siteId) => apiFetch(`/api/sites/${siteId}/members`),
  addMember: (siteId, userId) =>
    apiFetch(`/api/sites/${siteId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeMember: (siteId, userId) =>
    apiFetch(`/api/sites/${siteId}/members/${userId}`, { method: 'DELETE' }),
  getKpis: (siteId) => apiFetch(`/api/sites/${siteId}/kpis`),
  getGlobalKpis: () => apiFetch('/api/sites/kpis/global'),
};
