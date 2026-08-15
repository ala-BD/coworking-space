// hooks/useBookings.js — Hook pour la gestion des réservations
import { useState, useEffect, useCallback } from 'react';
import { bookingApi } from '../services/api';

export function useBookings(params = {}) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingApi.getAll(params);
      setBookings(data.reservations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const cancelBooking = useCallback(async (id) => {
    await bookingApi.cancel(id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, statut: 'cancelled' } : b));
  }, []);

  const updateBooking = useCallback(async (id, payload) => {
    const data = await bookingApi.update(id, payload);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...(data.reservation || payload) } : b));
    return data;
  }, []);

  return { bookings, loading, error, refetch: fetchBookings, cancelBooking, updateBooking };
}
