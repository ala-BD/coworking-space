// hooks/usePayments.js — Hook pour la gestion des paiements
import { useState, useEffect, useCallback } from 'react';
import { paymentApi } from '../services/api';

export function usePayments(params = {}) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentApi.getAll(params);
      setPayments(data.payments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const updatePayment = useCallback(async (id, payload) => {
    const data = await paymentApi.update(id, payload);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...(data.payment || payload) } : p));
    return data;
  }, []);

  return { payments, loading, error, refetch: fetchPayments, updatePayment };
}
