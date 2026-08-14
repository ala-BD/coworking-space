// services/api/guests.js — Réservations Invités (Module H)
import { apiFetch, API_URL } from './_core';

export const guestApi = {
  create: (payload) =>
    fetch(`${API_URL}/api/guests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  booking: (payload) =>
    fetch(`${API_URL}/api/guests/booking`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  formation: (payload) =>
    fetch(`${API_URL}/api/guests/formation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
  cancelByToken: (token) =>
    fetch(`${API_URL}/api/guests/booking/${token}`, { method: 'DELETE' }).then(r => r.json()),
  getAll: () => apiFetch('/api/guests'),
  convert: (id, payload) =>
    apiFetch(`/api/guests/${id}/convert`, { method: 'POST', body: JSON.stringify(payload) }),
};
