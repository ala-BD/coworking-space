// services/api/kpis.js — KPIs & Dashboard (Module D)
import { apiFetch } from './_core';

export const kpiApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/admin/kpis${qs ? `?${qs}` : ''}`);
  },
  getRevenueChart: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/admin/kpis/revenue-chart${qs ? `?${qs}` : ''}`);
  },
  getReport: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/admin/report${qs ? `?${qs}` : ''}`);
  },
};
