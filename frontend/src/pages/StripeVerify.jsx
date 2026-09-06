import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { paymentApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';
import { supabase } from '../supabaseClient';
import { getBookerNav } from '../utils/roles';

export default function StripeVerify({ session }) {
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data));

    const verifyPayment = async () => {
      const paymentId = searchParams.get('paymentId');
      const stripeSessionId = searchParams.get('session_id');

      if (!paymentId) {
        setStatus('error');
        setErrorMsg('Paramètres invalides.');
        return;
      }

      try {
        const res = await paymentApi.verifyStripe(paymentId, stripeSessionId);
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

  const paymentsHref = getBookerNav(profile?.role).payments;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            {status === 'verifying' && (
              <div className="card shadow-sm border-0 rounded-4">
                <div className="card-body text-center py-5">
                  <div className="spinner-border text-primary mb-4" role="status">
                    <span className="visually-hidden">Chargement...</span>
                  </div>
                  <h2 className="h4 fw-bold mb-3">Vérification de votre paiement</h2>
                  <p className="text-muted mb-0">Veuillez patienter, ne fermez pas cette page.</p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="card shadow-sm border-0 rounded-4">
                <div className="card-body text-center p-5">
                  <div className="avatar rounded-circle bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '90px', height: '90px' }}>
                    <i className="bi bi-check-circle-fill fs-1 text-success" />
                  </div>
                  <h2 className="h4 fw-bold mb-3">Paiement validé</h2>
                  <p className="text-muted mb-4">
                    Merci ! Votre transaction a bien été enregistrée. Vous allez recevoir un email avec votre reçu PDF.
                  </p>
                  <Link to={paymentsHref} className="btn btn-primary btn-lg px-5">
                    Retour à mes factures
                  </Link>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="card shadow-sm border-0 rounded-4">
                <div className="card-body text-center p-5">
                  <div className="avatar rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '90px', height: '90px' }}>
                    <i className="bi bi-x-circle-fill fs-1 text-danger" />
                  </div>
                  <h2 className="h4 fw-bold mb-3">Échec du paiement</h2>
                  <p className="text-muted mb-4">{errorMsg}</p>
                  <Link to={paymentsHref} className="btn btn-outline-primary btn-lg px-5">
                    Réessayer
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
