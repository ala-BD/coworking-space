// services/api/kpis.js — KPIs & Dashboard (Module D)
import { apiFetch } from './_core';

export const kpiApi = {
  getAll: () => apiFetch('/api/admin/kpis'),
  getRevenueChart: () => apiFetch('/api/admin/kpis/revenue-chart'),
};
