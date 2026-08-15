// hooks/useMembers.js — Hook pour la gestion des membres
import { useState, useEffect, useCallback } from 'react';
import { memberApi } from '../services/api';

export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memberApi.getAll();
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateMember = useCallback(async (id, payload) => {
    await memberApi.updateById(id, payload);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...payload } : m));
  }, []);

  return { members, loading, error, refetch: fetchMembers, updateMember };
}
