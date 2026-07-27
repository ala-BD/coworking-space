import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Session expirée.');
  return session.access_token;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Erreur API (${response.status})`);
  return body;
}

export const superAdminApi = {
  getStats: () => apiFetch('/api/super-admin/stats'),
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
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/super-admin/audit?${qs}`);
  },
};
