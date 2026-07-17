import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi } from '../services/api';

export default function BookingStep2() {
  const [searchParams] = useSearchParams();
  const espaceId = searchParams.get('espaceId');
  const navigate = useNavigate();

  const [space, setSpace] = useState(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [checking, setChecking] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (!espaceId) {
      navigate('/book/step1');
      return;
    }
    fetchSpace();

    // Default to tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
  }, [espaceId]);

  const fetchSpace = async () => {
    const { data, error } = await supabase
      .from('espaces')
      .select('*')
      .eq('id', espaceId)
      .single();

    if (!error && data) {
      setSpace(data);
    }
  };

  const handleCheckAvailability = async (e) => {
    e.preventDefault();
    setChecking(true);
    setAvailabilityMessage('');
    setIsAvailable(false);

    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(startDateTime) >= new Date(endDateTime)) {
      setAvailabilityMessage('L\'heure de fin doit être postérieure à l\'heure de début.');
      setChecking(false);
      return;
    }

    try {
      const result = await bookingApi.checkAvailability({
        espace_id: espaceId,
        date_debut: startDateTime,
        date_fin: endDateTime,
      });

      if (result.isAvailable) {
        setIsAvailable(true);
        setAvailabilityMessage('Ce créneau est disponible. Vous pouvez confirmer la réservation.');
      } else {
        setIsAvailable(false);
        setAvailabilityMessage('Ce créneau est déjà réservé. Choisissez un autre horaire.');
      }
    } catch (err) {
      setAvailabilityMessage(err.message || 'Impossible de vérifier la disponibilité.');
    } finally {
      setChecking(false);
    }
  };

  const handleProceed = () => {
    navigate(`/book/step3?espaceId=${espaceId}&date=${date}&start=${startTime}&end=${endTime}`);
  };

  if (!space) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-on-background font-inter pb-xl">
      {/* Top Header */}
      <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-sm">
        <div className="flex justify-between items-center px-margin-desktop py-sm max-w-container-max mx-auto">
          <Link to="/dashboard" className="font-sora text-headline-md font-bold text-primary">
            NexusDesk
          </Link>
          <div className="flex items-center gap-sm">
            <span className="text-body-sm text-on-surface-variant font-semibold">Étape 2 sur 3</span>
            <Link to="/book/step1" className="border border-outline-variant/30 text-primary px-sm py-xs rounded-lg font-semibold text-label-md hover:bg-surface-container-high transition-colors">
              Retour
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-24 max-w-[600px] mx-auto px-margin-mobile py-lg">
        <div className="bg-surface-container-lowest p-lg rounded-3xl border border-outline-variant/10 shadow-sm space-y-md">
          <div>
            <h1 className="font-sora text-headline-sm font-semibold text-primary mb-xs">Configurez votre créneau</h1>
            <p className="text-body-sm text-on-surface-variant">
              Espace sélectionné : <span className="font-semibold text-primary">{space.nom}</span> ({space.tarif_horaire} DT / h)
            </p>
          </div>

          <form onSubmit={handleCheckAvailability} className="space-y-md">
            <div>
              <label className="block font-inter text-label-sm text-primary mb-xs" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-outline-variant/30 rounded-xl px-sm py-xs text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="block font-inter text-label-sm text-primary mb-xs" htmlFor="start">
                  Heure de début
                </label>
                <input
                  id="start"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-xl px-sm py-xs text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block font-inter text-label-sm text-primary mb-xs" htmlFor="end">
                  Heure de fin
                </label>
                <input
                  id="end"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-white border border-outline-variant/30 rounded-xl px-sm py-xs text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={checking}
              className="w-full bg-primary text-white py-sm rounded-xl font-semibold text-label-md hover:bg-primary/95 transition-all active:scale-95 disabled:opacity-50"
            >
              {checking ? 'Vérification...' : 'Vérifier la disponibilité'}
            </button>
          </form>

          {availabilityMessage && (
            <div className={`p-sm rounded-xl text-body-sm flex items-center gap-xs ${
              isAvailable ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'
            }`}>
              <span className="material-symbols-outlined text-[18px]">
                {isAvailable ? 'check_circle' : 'warning'}
              </span>
              <span>{availabilityMessage}</span>
            </div>
          )}

          {isAvailable && (
            <button
              onClick={handleProceed}
              className="w-full bg-secondary text-on-secondary py-md rounded-xl font-semibold text-label-md hover:shadow-lg transition-all active:scale-95 flex justify-center items-center gap-xs"
            >
              Continuer vers la confirmation
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
