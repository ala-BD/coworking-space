// services/api/settings.js — Configuration / Politique d'annulation
import { apiFetch } from './_core';

export const settingsApi = {
  getCancellationPolicy: () => apiFetch('/api/settings/cancellation-policy'),
  updateCancellationPolicy: (payload) =>
    apiFetch('/api/settings/cancellation-policy', { method: 'PATCH', body: JSON.stringify(payload) }),
};
