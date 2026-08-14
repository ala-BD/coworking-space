// services/api/cancellationAdvanced.js — Politique annulation avancée + Crédits (Module J)
import { apiFetch } from './_core';

export const cancellationAdvancedApi = {
  getPoliciesByEspace: () => apiFetch('/api/cancellation-policies/espaces'),
  upsertPolicyEspace: (payload) =>
    apiFetch('/api/cancellation-policies/espaces', { method: 'PUT', body: JSON.stringify(payload) }),
  markNoShow: (reservationId) =>
    apiFetch(`/api/bookings/${reservationId}/noshow`, { method: 'POST' }),
  getCredits: (userId) => apiFetch(`/api/members/${userId}/credits`),
  addCredit: (userId, payload) =>
    apiFetch(`/api/members/${userId}/credits`, { method: 'POST', body: JSON.stringify(payload) }),
};
