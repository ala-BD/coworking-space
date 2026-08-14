// services/api/tenantAdmin.js — Admin Coworking Setup & Espaces
import { apiFetch } from './_core';

export const tenantAdminApi = {
  getTenant: () => apiFetch('/api/admin/tenant'),
  updateTenant: (payload) =>
    apiFetch('/api/admin/tenant', { method: 'PATCH', body: JSON.stringify(payload) }),
  getEspaces: () => apiFetch('/api/espaces'),
  createEspace: (payload) =>
    apiFetch('/api/admin/espaces', { method: 'POST', body: JSON.stringify(payload) }),
  updateEspace: (id, payload) =>
    apiFetch(`/api/admin/espaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteEspace: (id) =>
    apiFetch(`/api/admin/espaces/${id}`, { method: 'DELETE' }),
  completeOnboarding: () =>
    apiFetch('/api/admin/onboarding/complete', { method: 'POST' }),
  uploadPhoto: (payload) =>
    apiFetch('/api/admin/upload', { method: 'POST', body: JSON.stringify(payload) }),
};
