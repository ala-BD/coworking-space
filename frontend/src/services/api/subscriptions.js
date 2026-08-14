// services/api/subscriptions.js — Abonnements
import { apiFetch } from './_core';

export const subscriptionApi = {
  getMine: () => apiFetch('/api/subscriptions/me'),
  getActive: () => apiFetch('/api/subscriptions/me/active'),
  selfSubscribe: (payload) =>
    apiFetch('/api/subscriptions/self', { method: 'POST', body: JSON.stringify(payload) }),
};
