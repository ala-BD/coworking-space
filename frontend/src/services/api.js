import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Erreur API (${response.status})`);
  }
  return body;
}

export const memberApi = {
  getMe: () => apiFetch('/api/members/me'),
  updateMe: (payload) => apiFetch('/api/members/me', { method: 'PUT', body: JSON.stringify(payload) }),
};

export const subscriptionApi = {
  getMine: () => apiFetch('/api/subscriptions/me'),
  getActive: () => apiFetch('/api/subscriptions/me/active'),
};

export const bookingApi = {
  checkAvailability: (payload) =>
    apiFetch('/api/bookings/check-availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCalendar: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/calendar?${qs}`);
  },
  create: (payload) =>
    apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
};

export const paymentApi = {
  getAll: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/payments?${qs}`);
  },
  getMemberPayments: (memberId) => apiFetch(`/api/payments/member/${memberId}`),
  update: (id, payload) =>
    apiFetch(`/api/payments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  downloadReceipt: async (id) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/payments/${id}/receipt`, {
      headers: { ...headers },
    });
    if (!response.ok) throw new Error('Erreur de téléchargement');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },
  payWithFlouci: (paymentId) =>
    apiFetch('/api/flouci/pay', { method: 'POST', body: JSON.stringify({ paymentId }) }),
  verifyFlouci: (paymentId, flouciPaymentId) =>
    apiFetch('/api/flouci/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, payment_id: flouciPaymentId || undefined }),
    }),
};
