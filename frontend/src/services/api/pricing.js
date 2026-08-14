// services/api/pricing.js — Tarifs et Codes promo
import { apiFetch } from './_core';

export const pricingApi = {
  getPlans: () => apiFetch('/api/pricing'),
  getAllPlans: () => apiFetch('/api/pricing/all'),
  createPlan: (payload) =>
    apiFetch('/api/pricing', { method: 'POST', body: JSON.stringify(payload) }),
  updatePlan: (id, payload) =>
    apiFetch(`/api/pricing/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  validatePromo: (payload) =>
    apiFetch('/api/promo-codes/validate', { method: 'POST', body: JSON.stringify(payload) }),
  getPromoCodes: () => apiFetch('/api/promo-codes'),
  createPromoCode: (payload) =>
    apiFetch('/api/promo-codes', { method: 'POST', body: JSON.stringify(payload) }),
  updatePromoCode: (id, payload) =>
    apiFetch(`/api/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getMyHistory: () => apiFetch('/api/pricing/history/me'),
};
