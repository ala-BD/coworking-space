import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi, paymentApi } from '../services/api';
import BrandLogo from '../components/layout/BrandLogo';
import { getBookerNav } from '../utils/roles';

export default function BookingStep3({ session }) {
  const [searchParams] = useSearchParams();
  const espaceId = searchParams.get('espaceId');
  const date = searchParams.get('date');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const navigate = useNavigate();
  const [nav, setNav] = useState(getBookerNav('member'));

  const [space, setSpace] = useState(null);
  const [durationHours, setDurationHours] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [paymentMode, setPaymentMode] = useState('sur_place'); // 'sur_place' | 'online'
  const [processing, setProcessing] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [occupancy, setOccupancy] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setNav(getBookerNav(data?.role)));
    });
  }, []);

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
    setDurationHours(hours > 0 ? hours : 1);
  };

  useEffect(() => {
    if (space && durationHours > 0) {
      setTotalPrice(durationHours * space.tarif_horaire);
    }
  }, [space, durationHours]);

  useEffect(() => {
    if (!space || space.type !== 'open_space' || !date || !start || !end) return;
    const startDateTime = new Date(`${date}T${start}:00`).toISOString();
    const endDateTime = new Date(`${date}T${end}:00`).toISOString();
    bookingApi.checkAvailability({
      espace_id: espaceId,
      date_debut: startDateTime,
      date_fin: endDateTime,
    }).then((result) => {
      if (result.shared) {
        setOccupancy({
          remaining: result.remaining ?? 0,
          capacity: result.capacity ?? space.capacite ?? 0,
          occupied: result.overlapsCount ?? 0,
        });
      }
    }).catch(() => {});
  }, [space, date, start, end, espaceId]);

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
        throw new Error(availability.message || 'Ce créneau n\'est plus disponible. Veuillez en choisir un autre.');
      }

      // Créer la réservation avec statut 'pending' et le mode choisi
      const res = await bookingApi.create({
        espace_id: espaceId,
        date_debut: startDateTime,
        date_fin: endDateTime,
        mode: paymentMode,
      });

      const newBooking = res.reservation;

      if (!res.payment) {
        try {
          await paymentApi.createSelf({
            reservation_id: newBooking.id,
            montant: totalPrice,
            mode: paymentMode,
            statut: 'pending',
          });
        } catch (payErr) {
          console.warn('Création du paiement préventive:', payErr.message);
        }
      }

      // Afficher l'écran de confirmation
      setSubmittedBooking(newBooking);
    } catch (e) {
      setErrorMsg(e.message || 'Échec de la réservation.');
    } finally {
      setProcessing(false);
    }
  };

  if (!space) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #f95d00', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // Écran de succès après soumission de la demande
  if (submittedBooking) {
    return (
      <div style={{ backgroundColor: '#F4F6F9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '48px' }}>
        <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, backgroundColor: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', maxWidth: '1240px', margin: '0 auto' }}>
            <BrandLogo to={nav.home} />
            <Link 
              to={nav.bookings} 
              style={{ padding: '8px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, backgroundColor: '#f95d00', color: '#ffffff', textDecoration: 'none' }}
            >
              Mes réservations
            </Link>
          </div>
        </nav>

        <main style={{ paddingTop: '110px', maxWidth: '580px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 12px 36px rgba(0,0,0,0.06)', padding: '36px', textAlign: 'center' }}>
            
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff7ed', border: '2px solid #fdba74', color: '#f95d00', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>hourglass_top</span>
            </div>

            <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '99px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>
              Demande envoyée · En attente d'approbation
            </span>

            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: 700, color: '#100f0d', marginBottom: '12px' }}>
              Votre réservation a bien été enregistrée !
            </h1>

            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, marginBottom: '24px' }}>
              {paymentMode === 'sur_place' ? (
                <>
                  Votre demande pour <strong>{space.nom}</strong> a été transmise à l'administrateur. Dès qu'il l'aura acceptée, votre créneau sera réservé et vous pourrez <strong>régler sur place à l'accueil</strong> le jour de votre séance.
                </>
              ) : (
                <>
                  Votre demande pour <strong>{space.nom}</strong> a été transmise à l'administrateur. Dès qu'il l'aura acceptée, vous pourrez <strong>payer en ligne par carte bancaire</strong> depuis vos factures.
                </>
              )}
            </p>

            {/* Récapitulatif box */}
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '28px', textAlign: 'left', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Espace :</span>
                <strong style={{ color: '#0f172a' }}>{space.nom}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Date :</span>
                <strong style={{ color: '#0f172a' }}>{new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Créneau :</span>
                <strong style={{ color: '#0f172a' }}>{start} → {end} ({durationHours}h)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Mode de paiement :</span>
                <strong style={{ color: '#f95d00' }}>{paymentMode === 'sur_place' ? '💵 Sur place (à l\'accueil)' : '💳 En ligne (après validation)'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '8px' }}>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Total :</span>
                <strong style={{ color: '#f95d00', fontSize: '16px' }}>{totalPrice.toFixed(2)} DT</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link
                to={nav.home}
                style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, fontSize: '14px', textDecoration: 'none', backgroundColor: '#ffffff' }}
              >
                Tableau de bord
              </Link>
              <Link
                to={nav.bookings}
                style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', backgroundColor: '#f95d00', color: '#ffffff', fontWeight: 700, fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,93,0,0.3)' }}
              >
                Mes réservations →
              </Link>
            </div>

          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F4F6F9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '48px' }}>
      
      {/* Top Header */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, backgroundColor: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', maxWidth: '1240px', margin: '0 auto' }}>
          <BrandLogo to={nav.home} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f95d00', backgroundColor: '#ffedd8', padding: '6px 14px', borderRadius: '99px' }}>
              Étape 3 sur 3
            </span>
            <Link 
              to={`/book/step2?espaceId=${espaceId}`} 
              style={{ padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: '1px solid #c5c6ce', color: '#100f0d', textDecoration: 'none', backgroundColor: '#fff' }}
            >
              Retour
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ paddingTop: '110px', maxWidth: '620px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' }}>
        
        {/* Card Form */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', padding: '32px' }}>
          
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: 700, color: '#100f0d', marginBottom: '6px' }}>
              Récapitulatif & Paiement
            </h1>
            <p style={{ fontSize: '14px', color: '#5a6a8a', margin: 0 }}>
              Choisissez comment vous souhaitez régler votre réservation.
            </p>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
              {errorMsg}
            </div>
          )}

          {/* Details Box */}
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#100f0d' }}>{space.nom}</span>
              <span style={{ backgroundColor: '#ffedd8', color: '#f95d00', padding: '4px 12px', borderRadius: '99px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                {space.type ? space.type.replace('_', ' ') : 'Espace'}
              </span>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#5a6a8a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date</span>
                <strong style={{ color: '#000d23' }}>{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Créneau horaire</span>
                <strong style={{ color: '#000d23' }}>{start} - {end} ({durationHours} h)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tarif horaire</span>
                <strong style={{ color: '#000d23' }}>{parseFloat(space.tarif_horaire).toFixed(2)} DT / h</strong>
              </div>
              {occupancy && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Places restantes</span>
                  <strong style={{ color: occupancy.remaining > 0 ? '#059669' : '#dc2626' }}>
                    {occupancy.remaining} / {occupancy.capacity}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* SÉLECTION DU MODE DE PAIEMENT */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#334155', marginBottom: '12px' }}>
              Mode de paiement souhaité *
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Option 1 : Payer sur place */}
              <div
                onClick={() => setPaymentMode('sur_place')}
                style={{
                  border: paymentMode === 'sur_place' ? '2px solid #f95d00' : '1px solid #e2e8f0',
                  backgroundColor: paymentMode === 'sur_place' ? '#fffaf5' : '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', color: paymentMode === 'sur_place' ? '#f95d00' : '#64748b' }}>
                    storefront
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#100f0d' }}>
                    Sur place
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                  À l'accueil le jour J (Espèces, chèque ou TPE).
                </p>
                {paymentMode === 'sur_place' && (
                  <span style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f95d00' }} />
                )}
              </div>

              {/* Option 2 : Payer en ligne */}
              <div
                onClick={() => setPaymentMode('online')}
                style={{
                  border: paymentMode === 'online' ? '2px solid #f95d00' : '1px solid #e2e8f0',
                  backgroundColor: paymentMode === 'online' ? '#fffaf5' : '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', color: paymentMode === 'online' ? '#f95d00' : '#64748b' }}>
                    credit_card
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#100f0d' }}>
                    En ligne
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                  Par carte bancaire (dès acceptation de l'admin).
                </p>
                {paymentMode === 'online' && (
                  <span style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f95d00' }} />
                )}
              </div>
            </div>

            {/* Note explicative selon le mode choisi */}
            <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              {paymentMode === 'sur_place' ? (
                <>
                  ℹ️ <strong>Processus :</strong> Votre réservation sera envoyée en attente. Une fois acceptée par l'administrateur, votre espace est garanti et vous réglerez à votre arrivée.
                </>
              ) : (
                <>
                  ℹ️ <strong>Processus :</strong> Votre réservation sera envoyée en attente. Dès que l'administrateur l'aura acceptée, un bouton « Payer en ligne » apparaîtra dans votre espace membre pour régler par carte.
                </>
              )}
            </div>
          </div>

          {/* Total Price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: 700, color: '#100f0d' }}>Estimation Total</span>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: 800, color: '#f95d00' }}>{totalPrice.toFixed(2)} DT</span>
          </div>

          <button
            onClick={handleConfirmBooking}
            disabled={processing}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#f95d00',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(249,93,0,0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {processing ? 'Enregistrement de la demande...' : `Envoyer la demande de réservation (${totalPrice.toFixed(2)} DT)`}
          </button>

        </div>
      </main>
    </div>
  );
}
