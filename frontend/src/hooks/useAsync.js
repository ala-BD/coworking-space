// hooks/useAsync.js — Hook générique pour gérer les appels async (loading, error, data)
import { useState, useCallback } from 'react';

/**
 * Hook pour exécuter une fonction async en gérant loading/error/data automatiquement.
 * 
 * Usage:
 *   const { execute, data, loading, error } = useAsync(memberApi.getAll);
 *   useEffect(() => { execute(); }, [execute]);
 */
export function useAsync(asyncFn, immediate = false) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset, setData };
}
