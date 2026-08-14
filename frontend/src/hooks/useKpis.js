// hooks/useKpis.js — Hook pour les KPIs dashboard admin
import { useState, useEffect, useCallback } from 'react';
import { kpiApi } from '../services/api';

export function useKpis() {
  const [kpis, setKpis] = useState(null);
  const [revenueChart, setRevenueChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisData, chartData] = await Promise.all([
        kpiApi.getAll(),
        kpiApi.getRevenueChart(),
      ]);
      setKpis(kpisData);
      setRevenueChart(chartData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  return { kpis, revenueChart, loading, error, refetch: fetchKpis };
}
