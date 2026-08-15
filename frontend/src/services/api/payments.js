// services/api/payments.js — Paiements & Stripe (Module C)
import { apiFetch, getAuthHeaders, API_URL } from './_core';

export const paymentApi = {
  getAll: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/payments?${qs}`);
  },
  getMemberPayments: (memberId) => apiFetch(`/api/payments/member/${memberId}`),
  createSelf: (payload) =>
    apiFetch('/api/payments/self', { method: 'POST', body: JSON.stringify(payload) }),
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
  payWithStripe: (paymentId) =>
    apiFetch('/api/stripe/pay', { method: 'POST', body: JSON.stringify({ paymentId }) }),
  verifyStripe: (paymentId, sessionId) =>
    apiFetch('/api/stripe/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, session_id: sessionId || undefined }),
    }),
};
