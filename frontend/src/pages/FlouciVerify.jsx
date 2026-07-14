import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { supabase } from '../supabaseClient';

export default function FlouciVerify({ session }) {
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data));

    const verifyPayment = async () => {
      const paymentId = searchParams.get('paymentId');
      const flouciPaymentId = searchParams.get('payment_id');

      if (!paymentId) {
        setStatus('error');
        setErrorMsg('Paramètres invalides.');
        return;
      }

      try {
        const res = await paymentApi.verifyFlouci(paymentId, flouciPaymentId);
        if (res.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMsg(res.message || 'Le paiement a été refusé ou annulé.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Erreur lors de la vérification.');
      }
    };

    verifyPayment();
  }, [searchParams, session.user.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {status === 'verifying' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-secondary mx-auto mb-6" />
            <h2 className="font-sora text-headline-sm font-bold text-primary">Vérification de votre paiement...</h2>
            <p className="text-body-md text-on-surface-variant mt-2">Veuillez patienter, ne fermez pas cette page.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center max-w-md bg-surface-container-lowest p-xl rounded-2xl border border-outline-variant/30 shadow-sm">
            <div className="w-20 h-20 bg-[#D1FAE5] text-[#065F46] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[40px]">check_circle</span>
            </div>
            <h2 className="font-sora text-headline-sm font-bold text-primary mb-2">Paiement validé !</h2>
            <p className="text-body-md text-on-surface-variant mb-8">
              Merci ! Votre transaction a bien été enregistrée. Vous allez recevoir un email avec votre reçu PDF.
            </p>
            <Link
              to="/member/payments"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Retour à mes factures
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center max-w-md bg-surface-container-lowest p-xl rounded-2xl border border-error-container shadow-sm">
            <div className="w-20 h-20 bg-[#FEE2E2] text-[#991B1B] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[40px]">error</span>
            </div>
            <h2 className="font-sora text-headline-sm font-bold text-primary mb-2">Échec du paiement</h2>
            <p className="text-body-md text-on-surface-variant mb-8">{errorMsg}</p>
            <Link
              to="/member/payments"
              className="inline-block px-6 py-3 bg-surface-container-high text-on-surface rounded-lg font-semibold hover:bg-primary/10 transition-colors"
            >
              Réessayer
            </Link>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
