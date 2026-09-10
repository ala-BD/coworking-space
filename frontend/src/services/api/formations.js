// services/api/formations.js — Formateurs & Formations (Module G)
import { apiFetch } from './_core';

export const formationApi = {
  // ── Formateurs ──────────────────────────────────────────────────────────
  getFormateurs: () => apiFetch('/api/formateurs'),
  getFormateur: (id) => apiFetch(`/api/formateurs/${id}`),
  getMyCoworkings: () => apiFetch('/api/formateurs/me/coworkings'),
  createFormateur: (payload) =>
    apiFetch('/api/formateurs', { method: 'POST', body: JSON.stringify(payload) }),
  updateFormateur: (id, payload) =>
    apiFetch(`/api/formateurs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addRemuneration: (formateurId, payload) =>
    apiFetch(`/api/formateurs/${formateurId}/remuneration`, { method: 'POST', body: JSON.stringify(payload) }),

  // ── Formations ──────────────────────────────────────────────────────────
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/formations${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => apiFetch(`/api/formations/${id}`),
  create: (payload) =>
    apiFetch('/api/formations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    apiFetch(`/api/formations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) =>
    apiFetch(`/api/formations/${id}`, { method: 'DELETE' }),

  // ── Inscriptions ────────────────────────────────────────────────────────
  inscrire: (formationId, payload = {}) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  desinscrire: (formationId, userId) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`, {
      method: 'DELETE',
      body: JSON.stringify(userId ? { user_id: userId } : {}),
    }),
  getParticipants: (formationId) =>
    apiFetch(`/api/formations/${formationId}/inscriptions`),
  marquerPresence: (formationId, userId, present) =>
    apiFetch(`/api/formations/${formationId}/inscriptions/${userId}/presence`, {
      method: 'PATCH',
      body: JSON.stringify({ present }),
    }),
  getEmargement: (formationId) =>
    apiFetch(`/api/formations/${formationId}/emargement`),

  // ── Espace membre ────────────────────────────────────────────────────────
  getMesFormations: () => apiFetch('/api/members/me/formations'),
  createFormationPayment: (formationId, payload = {}) =>
    apiFetch(`/api/formations/${formationId}/inscriptions/payment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
