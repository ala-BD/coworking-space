import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi, paymentApi } from '../services/api';
import BrandLogo from '../components/layout/BrandLogo';

export default function BookingStep3({ session }) {
  const [searchParams] = useSearchParams();
  const espaceId = searchParams.get('espaceId');
  const date = searchParams.get('date');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const navigate = useNavigate();

  const [space, setSpace] = useState(null);
  const [durationHours, setDurationHours] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!espaceId || !date || !start || !end) {
      navigate('/book/step1');
      return;
    }
    fetchSpace();
    calculatePrice();
  }, [espaceId, date, start, end]);

  const fetchSpace = async () => {
    const { data: sp } = await supabase
      .from('espaces')
      .select('*')
      .eq('id', espaceId)
      .single();
    if (sp) setSpace(sp);
  };

  const calculatePrice = () => {
    const startDateTime = new Date(`${date}T${start}:00`);
    const endDateTime = new Date(`${date}T${end}:00`);
    const hours = (endDateTime - startDateTime) / 3600000;
    setDurationHours(hours);
  };

  useEffect(() => {
    if (space && durationHours > 0) {
      setTotalPrice(durationHours * space.tarif_horaire);
    }
  }, [space, durationHours]);

  const handleConfirmBooking = async () => {
    setProcessing(true);
    setErrorMsg('');
    const startDateTime = new Date(`${date}T${start}:00`).toISOString();
    const endDateTime = new Date(`${date}T${end}:00`).toISOString();

    try {
      const availability = await bookingApi.checkAvailability({
        espace_id: espaceId,
        date_debut: startDateTime,
        date_fin: endDateTime,
      });

      if (!availability.isAvailable) {
        throw new Error('Ce créneau n\'est plus disponible.');
      }

      // Créer la réservation
      const reservation = await bookingApi.create({
        espace_id: espaceId,
        date_debut: startDateTime,
        date_fin: endDateTime,
        mode: 'online',
      });

      // Créer automatiquement un paiement pour cette réservation
      const payment = await paymentApi.createSelf({
        reservation_id: reservation.reservation.id,
        montant: totalPrice,
        mode: 'online',
        statut: 'pending',
      });

      // Rediriger vers Stripe Checkout
      const stripeResponse = await paymentApi.payWithStripe(payment.payment.id);
      if (stripeResponse.link) {
        window.location.href = stripeResponse.link;
      } else {
        throw new Error('Lien de paiement non reçu.');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Échec de la réservation.');
    } finally {
      setProcessing(false);
    }
  };

  if (!space) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6F9] min-h-screen text-on-background font-inter pb-xl">
      <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-sm">
        <div className="flex justify-between items-center px-margin-desktop py-sm max-w-container-max mx-auto">
          <BrandLogo to="/dashboard" />
          <div className="flex items-center gap-sm">
            <span className="text-body-sm text-on-surface-variant font-semibold">Étape 3 sur 3</span>
            <Link to={`/book/step2?espaceId=${espaceId}`} className="border border-outline-variant/30 text-primary px-sm py-xs rounded-lg font-semibold text-label-md hover:bg-surface-container-high transition-colors">
              Retour
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 max-w-[600px] mx-auto px-margin-mobile py-lg">
        {success ? (
          <div className="bg-surface-container-lowest p-lg rounded-3xl border border-outline-variant/10 shadow-sm text-center py-xl space-y-md">
            <div className="w-16 h-16 bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center rounded-full mx-auto animate-bounce">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h1 className="font-sora text-headline-sm font-semibold text-primary">Réservation enregistrée</h1>
            <p className="text-body-sm text-on-surface-variant max-w-xs mx-auto">
              Votre demande est en attente de confirmation. Le paiement sera géré par l'équipe réception (Module C — Dev 2).
            </p>
            <p className="text-label-sm text-secondary font-semibold animate-pulse">Redirection vers le portail...</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest p-lg rounded-3xl border border-outline-variant/10 shadow-sm space-y-lg">
            <div>
              <h1 className="font-sora text-headline-sm font-semibold text-primary mb-xs">Récapitulatif</h1>
              <p className="text-body-sm text-on-surface-variant">Vérifiez votre réservation avant confirmation.</p>
            </div>

            {errorMsg && (
              <div className="p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="p-md bg-surface-container-low rounded-2xl space-y-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-body-md text-primary">{space.nom}</span>
                <span className="text-label-sm text-secondary bg-secondary-fixed text-on-secondary-fixed px-sm py-xs rounded-full uppercase tracking-wider font-semibold">
                  {space.type.replace('_', ' ')}
                </span>
              </div>
              <div className="border-t border-outline-variant/10 pt-sm space-y-xs text-body-sm text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Date</span>
                  <span className="font-semibold text-primary">{new Date(date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Créneau</span>
                  <span className="font-semibold text-primary">{start} - {end} ({durationHours} h)</span>
                </div>
                <div className="flex justify-between">
                  <span>Tarif horaire</span>
                  <span className="font-semibold text-primary">{space.tarif_horaire} DT / h</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center py-sm border-y border-outline-variant/10">
              <span className="font-sora text-headline-sm text-primary font-semibold">Estimation</span>
              <span className="font-sora text-headline-sm font-bold text-secondary">{totalPrice.toFixed(2)} DT</span>
            </div>

            <p className="text-body-xs text-on-surface-variant bg-surface-container-low p-sm rounded-xl">
              Le paiement et la facturation seront intégrés par Dev 2 (Module C). Cette étape crée uniquement la réservation en statut « pending ».
            </p>

            <button
              onClick={handleConfirmBooking}
              disabled={processing}
              className="w-full bg-secondary text-on-secondary py-md rounded-xl font-semibold text-label-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-sm"
            >
              {processing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined">event_available</span>
                  <span>Confirmer la réservation</span>
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
