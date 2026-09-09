// services/api/superAdmin.js — Super Admin API (Tenants + Users + Audit)
import { apiFetch } from './_core';

export const superAdminApi = {
  getStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/stats${qs ? `?${qs}` : ''}`);
  },

  getReport: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/report${qs ? `?${qs}` : ''}`);
  },

  // Tenants
  getTenants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/tenants?${qs}`);
  },
  getTenant: (id) => apiFetch(`/api/super-admin/tenants/${id}`),
  createTenant: (data) =>
    apiFetch('/api/super-admin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id, data) =>
    apiFetch(`/api/super-admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTenant: (id) =>
    apiFetch(`/api/super-admin/tenants/${id}`, { method: 'DELETE' }),
  onboardTenant: (id, data) =>
    apiFetch(`/api/super-admin/tenants/${id}/onboard`, { method: 'POST', body: JSON.stringify(data) }),

  // Audit
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/audit?${qs}`);
  },

  // Utilisateurs
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/users?${qs}`);
  },
  updateUser: (id, data) =>
    apiFetch(`/api/super-admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id) =>
    apiFetch(`/api/super-admin/users/${id}`, { method: 'DELETE' }),
  getRolesSummary: () => apiFetch('/api/super-admin/users/roles-summary'),
};
