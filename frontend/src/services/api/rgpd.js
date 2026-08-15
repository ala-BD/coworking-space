// services/api/rgpd.js — RGPD (Module L)
import { apiFetch } from './_core';

export const rgpdApi = {
  submitRequest: (payload) =>
    apiFetch('/api/rgpd/request', { method: 'POST', body: JSON.stringify(payload) }),
  getMyRequests: () => apiFetch('/api/rgpd/my-requests'),
  updateMarketing: (payload) =>
    apiFetch('/api/members/me/marketing', { method: 'PATCH', body: JSON.stringify(payload) }),
  getAdminRequests: () => apiFetch('/api/admin/rgpd'),
  processRequest: (id, payload) =>
    apiFetch(`/api/admin/rgpd/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
