// services/api/bookings.js — Réservations & Espaces
import { apiFetch } from './_core';

export const bookingApi = {
  checkAvailability: (payload) =>
    apiFetch('/api/bookings/check-availability', { method: 'POST', body: JSON.stringify(payload) }),

  getCalendar: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/calendar?${qs}`);
  },

  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings${qs ? `?${qs}` : ''}`);
  },

  create: (payload) =>
    apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id, payload) =>
    apiFetch(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  cancel: (id) =>
    apiFetch(`/api/bookings/${id}`, { method: 'DELETE' }),

  getCancelInfo: (id) =>
    apiFetch(`/api/bookings/${id}/cancel-info`),

  getOccupation: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/bookings/occupation?${qs}`);
  },

  getEspaces: () => apiFetch('/api/espaces'),
};
