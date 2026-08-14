// hooks/useEspaces.js — Hook pour les espaces du tenant admin
import { useState, useEffect, useCallback } from 'react';
import { tenantAdminApi } from '../services/api';

export function useEspaces() {
  const [espaces, setEspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tenantAdminApi.getEspaces();
      setEspaces(data.espaces || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEspaces(); }, [fetchEspaces]);

  const createEspace = useCallback(async (payload) => {
    const data = await tenantAdminApi.createEspace(payload);
    setEspaces(prev => [...prev, data.espace]);
    return data.espace;
  }, []);

  const updateEspace = useCallback(async (id, payload) => {
    const data = await tenantAdminApi.updateEspace(id, payload);
    setEspaces(prev => prev.map(e => e.id === id ? { ...e, ...(data.espace || payload) } : e));
    return data.espace;
  }, []);

  const deleteEspace = useCallback(async (id) => {
    await tenantAdminApi.deleteEspace(id);
    setEspaces(prev => prev.filter(e => e.id !== id));
  }, []);

  return { espaces, loading, error, refetch: fetchEspaces, createEspace, updateEspace, deleteEspace };
}
